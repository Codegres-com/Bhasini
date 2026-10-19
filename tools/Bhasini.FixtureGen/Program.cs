using System.ComponentModel;
using System.Globalization;
using System.Reflection;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;
using Bhasini.Core.Input;
using Bhasini.Core.Languages;
using Bhasini.Core.Scripts;
using Bhasini.Mcp;
using ModelContextProtocol;
using ModelContextProtocol.Server;

// Exports what the TypeScript port in workers/bhasini-mcp needs from the C# reference implementation:
//   src/generated/tools.json      MCP tool definitions, exactly as the C# server lists them
//   src/generated/unassigned.json code points .NET treats as unassigned in each Indic block
//   test/fixtures.json            inputs and the C# outputs the port must reproduce
//
//   dotnet run --project tools/Bhasini.FixtureGen -- workers/bhasini-mcp

var root = Path.GetFullPath(args.Length > 0 ? args[0] : "workers/bhasini-mcp");
var json = new JsonSerializerOptions(McpJsonUtilities.DefaultOptions)
{
    Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    WriteIndented = true,
};

void Write(string relative, object value)
{
    var path = Path.Combine(root, relative);
    Directory.CreateDirectory(Path.GetDirectoryName(path)!);
    File.WriteAllText(path, JsonSerializer.Serialize(value, json) + "\n");
}

// ---- Tool definitions ----

var tools = typeof(IndicTools).GetMethods(BindingFlags.Public | BindingFlags.Static)
    .Where(m => m.GetCustomAttribute<McpServerToolAttribute>() != null)
    .Select(m => McpServerTool.Create(m, target: null, new McpServerToolCreateOptions { SerializerOptions = json }).ProtocolTool)
    .OrderBy(t => t.Name, StringComparer.Ordinal)
    .ToList();
Write("src/generated/tools.json", tools);

// ---- Unicode availability, so the port doesn't depend on the JS engine's Unicode version ----

var unassigned = new SortedDictionary<string, List<int>>(StringComparer.Ordinal);
foreach (var mapper in ScriptMappers.Sources.OfType<OffsetScriptMapper>().DistinctBy(m => m.BlockBase))
{
    unassigned[mapper.BlockBase.ToString("X4")] = Enumerable.Range(mapper.BlockBase, 0x80)
        .Where(c => CharUnicodeInfo.GetUnicodeCategory(c) == UnicodeCategory.OtherNotAssigned)
        .ToList();
}
Write("src/generated/unassigned.json", unassigned);

// ---- Fixtures ----

var languages = LanguageCatalog.All.Where(l => !l.IsEnglish).ToList();
var words = new[]
{
    "namaste", "namaskAr", "namaskAra", "dhanyavAd", "bhArat", "kamal", "kShatriya", "zindagI", "saMskRtam",
    "kRShNa", "vaNakkam", "nanRi", "thamizh", "malayaaLam", "ente manushyan", "avan", "enthu", "kEraLam",
    "pakkA", "panjAbI", "sat srI akAl", "amritasar", "o.DiA", "o.DishA", "meeteilon", "khurumjari", "santaRi",
    "jOhAr", "aadaab", "kitaab", "urdu", "kashur", "sindhii", "salaam", "beMgaLUru", "kalakAtA", "maithilI",
    "Hello, World! 123", "k_h", "rAm.h", "a|b||c", "OM namaH shivAya", "~NG ~n JN", "R^i RRI", "^e ^o",
    "Kh Gh Ee", "x ksh GY jn dny", "q z f .D .Dh", "rx Lx nx", "tsh ts aa' o' u'", "gg ng jj ny dd bb",
    "t' s' z' zz zh KH Rh Y '' '", "a O aw ~ : ''", "kkk", "nta ntha nda nna", "kannaD", "beLe", "shALA",
};

var transliterate = new List<object>();
foreach (var l in languages)
{
    var keys = l.Phonetic!.Keymap.SelectMany(g => g.Entries).SelectMany(e => e.Keys.Split(' ')).Distinct().ToList();
    var inputs = new List<string>(words);
    inputs.AddRange(keys);
    // Every key followed by each vowel, and doubled, to cover conjuncts and word-final rules.
    foreach (var k in keys)
    {
        foreach (var v in new[] { "a", "A", "i", "u", "e", "o", "" }) inputs.Add(k + v + "n");
        inputs.Add(k + k);
        inputs.Add("a" + k + "Ma");
    }
    foreach (var input in inputs.Distinct())
    {
        transliterate.Add(new { lang = l.Code, input, output = IndicTools.Transliterate(input, l.Code) });
    }
}

// Script conversion: every mappable Devanagari letter and the sample words, first written in each
// source script, then converted into every target script.
var deva = Enumerable.Range(0x0901, 0x6F).Select(c => ((char)c).ToString())
    .Concat(new[] { "नमस्ते भारत", "क्षत्रिय", "ज़िन्दगी", "संस्कृतम्", "कृष्ण", "ॐ नमः शिवाय", "क़ ख़ ग़ ज़ ड़ ढ़ फ़ य़", "२०२६", "Hello, नमस्ते!" })
    .ToList();
var targets = languages.Where(ScriptConverter.CanConvertTo).ToList();
var convert = new List<object>();
foreach (var source in targets.DistinctBy(t => t.Mapper))
{
    foreach (var d in deva)
    {
        var text = ScriptConverter.ConvertScript(d, source);
        foreach (var target in targets)
        {
            convert.Add(new { target = target.Code, input = text, output = IndicTools.ConvertScript(text, target.Code) });
        }
    }
}

var digits = languages.Where(l => l.DigitMapper != null)
    .Select(l => new { lang = l.Code, input = "Year 2026, 0123456789", output = IndicTools.NativeDigits("Year 2026, 0123456789", l.Code) })
    .ToList();

Write("test/fixtures.json", new
{
    languages = IndicTools.ListLanguages(),
    keymaps = languages.ToDictionary(l => l.Code, l => IndicTools.GetKeymap(l.Code)),
    transliterate,
    convert,
    digits,
});

Console.WriteLine($"Wrote {tools.Count} tools, {transliterate.Count} transliterations, {convert.Count} conversions to {root}");
