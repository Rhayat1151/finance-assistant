export async function searchMerchant(query: string): Promise<string> {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query + ' merchant company')}&format=json&no_html=1&skip_disambig=1`
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    const json = await res.json()

    if (json.AbstractText) return json.AbstractText
    if (json.Answer) return json.Answer
    if (json.RelatedTopics?.[0]?.Text) return json.RelatedTopics[0].Text

    return `No specific information found for "${query}". It may be a local business or an obscure merchant code.`
  } catch {
    return `Could not look up "${query}" — search unavailable right now.`
  }
}
