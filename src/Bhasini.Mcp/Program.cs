using System.Text.Encodings.Web;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using ModelContextProtocol;

// Bhasini MCP server over stdio. Everything runs on the user's machine with the same engine as
// bhasini.com, so no text leaves the device and there is no server to host.
var builder = Host.CreateApplicationBuilder(args);

// stdout carries the MCP protocol; logs go to stderr.
builder.Logging.AddConsole(options => options.LogToStandardErrorThreshold = LogLevel.Trace);

builder.Services
    .AddMcpServer()
    .WithStdioServerTransport()
    // Keep Indic letters readable in JSON results instead of escaping them (fewer tokens for the model).
    .WithToolsFromAssembly(serializerOptions: new JsonSerializerOptions(McpJsonUtilities.DefaultOptions)
    {
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    });

await builder.Build().RunAsync();
