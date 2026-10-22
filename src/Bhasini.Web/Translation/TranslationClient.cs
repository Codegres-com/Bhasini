using System.Net.Http.Json;

namespace Bhasini.Web.Translation
{
    // Calls the Bhasini translation API (workers/bhasini-mcp, POST /v1/translate). Translation is the
    // one editor feature that sends text to a server; everything else runs in the browser.
    public sealed class TranslationClient(HttpClient http, Uri endpoint)
    {
        // Free limits, enforced by the Worker (workers/bhasini-mcp/src/quota.ts); shown in the dialog.
        public const int MaxCharacters = 2_000;
        public const int FreeCharactersPerDay = 10_000;

        public sealed record Result(string Translation, string Source, string Target, int Characters, int? FreeCharsLeftToday);

        private sealed record ErrorBody(string? Error);

        // "auto" (or null) lets the server detect the source language. Codes are LanguageCatalog codes, or "en".
        public async Task<Result> TranslateAsync(string text, string? source, string target, CancellationToken cancellationToken = default)
        {
            HttpResponseMessage response;
            try
            {
                response = await http.PostAsJsonAsync(endpoint, new { text, source = source ?? "auto", target }, cancellationToken);
            }
            catch (HttpRequestException)
            {
                throw new TranslationException("Could not reach the translation service. Check your internet connection.");
            }

            using (response)
            {
                if (response.IsSuccessStatusCode)
                {
                    return await response.Content.ReadFromJsonAsync<Result>(cancellationToken)
                        ?? throw new TranslationException("The translation service sent an empty reply.");
                }
                ErrorBody? error = null;
                try { error = await response.Content.ReadFromJsonAsync<ErrorBody>(cancellationToken); } catch { }
                throw new TranslationException(error?.Error ?? $"Translation failed ({(int)response.StatusCode}).");
            }
        }
    }

    public sealed class TranslationException(string message) : Exception(message);
}
