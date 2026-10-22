using Bhasini.Core.Input;
using Bhasini.Web;
using Bhasini.Web.Translation;
using Microsoft.AspNetCore.Components.Web;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;

var builder = WebAssemblyHostBuilder.CreateDefault(args);
builder.RootComponents.Add<App>("#app");
builder.RootComponents.Add<HeadOutlet>("head::after");

builder.Services.AddScoped<TypingSession>();

// Translation runs on the deployed Worker (workers/bhasini-mcp), also in development. To test a local
// `npm run dev` Worker, put {"TranslateEndpoint": "http://localhost:8787/v1/translate"} in
// wwwroot/appsettings.Development.json (not committed).
var translateEndpoint = new Uri(builder.Configuration["TranslateEndpoint"] ?? "https://mcp.bhasini.com/v1/translate");
builder.Services.AddScoped(_ => new TranslationClient(new HttpClient { Timeout = TimeSpan.FromSeconds(90) }, translateEndpoint));

await builder.Build().RunAsync();
