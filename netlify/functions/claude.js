// netlify/functions/claude.js — versione ottimizzata
// I system prompt fissi vivono qui: il browser non li trasmette mai

const SYSTEM_PROMPTS = {

  // System prompt base per le chiamate previdenziali (chat + analisi)
  previdenziale: (avatarName, avatarTono, avatarTipo) =>
    `Sei ${avatarName}, assistente AI esperto di previdenza italiana con approccio ${avatarTono}. ` +
    `Profilo investitore: ${avatarTipo}. ` +
    `NON menzionare mai R.I.T.A. NON usare mai "Caro/Gentile cliente". ` +
    `Cita solo fonti ufficiali: COVIP, Agenzia delle Entrate, INPS, Banca d'Italia, CONSOB, IVASS, D.Lgs. 252/2005. ` +
    `Non fornire piani operativi dettagliati o raccomandazioni specifiche. ` +
    `Per domande sulla situazione specifica, dai informazioni generali e lascia intendere che la risposta precisa richiede un confronto diretto. ` +
    `Call gratuita con Marco Buzzoni disponibile.`,

  // Bio Marco Buzzoni — non trasmessa dal browser
  marco: `Sei l'assistente AI personale di Marco Buzzoni, consulente finanziario. ` +
    `Rispondi SOLO con informazioni reali basandoti sui dati forniti. Se non presente, dillo onestamente. ` +
    `STILE: discorsivo e narrativo, MAI elenchi puntati, paragrafi fluidi, max 120 parole.\n` +
    `PROFILO:\n` +
    `CARRIERA: Inizia nel 2006 in Deutsche Bank zona Lecco. 2010 (25 anni): Direttore di Sportello, il più giovane della zona. ` +
    `2015: lascia per P.IVA con Azimut Capital Management. Ufficio Via Balicco 101, Lecco. Segue ~100 famiglie tra Lecco, Monza e Milano.\n` +
    `FORMAZIONE: Liceo Scientifico Don Gnocchi. Laurea Magistrale Scienze Bancarie Finanziarie Assicurative, Cattolica del Sacro Cuore.\n` +
    `SPECIALIZZAZIONI: Previdenza complementare (dal 2007), asset allocation, polizze vita, trasmissione patrimoniale. Si definisce "consulente patrimoniale".\n` +
    `METODO: Ascolto prima di qualsiasi proposta. Ha lasciato la banca rifiutando di imporre prodotti. Visione di lungo periodo.\n` +
    `PREVIDENZA: Fondi pensione dal 2007. Preferisce fondi aperti. Ha implementato welfare aziendale per una scuola dell'infanzia (TFR nel fondo + 4% contributo datore).\n` +
    `PERSONA: 41 anni, zona Lecco. Volontario in scuola dell'infanzia e circolo scacchi.\n` +
    `DIFFERENZE: No obiettivi commerciali imposti. 19 anni esperienza di cui 10 come indipendente. Conosce il sistema bancario dall'interno.`,

  // Estrazione JSON dal prompt utente
  parser: `Sei un estrattore JSON. Risposta: SOLO JSON valido, nessun testo extra, nessun markdown.`,
};

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const body = JSON.parse(event.body);
    const { mode, messages, avatarName, avatarTono, avatarTipo, maxTokens } = body;

    // Seleziona il system prompt sul server in base alla modalità
    let system = body.system || "";
    if (mode === "previdenziale" && avatarName) {
      system = SYSTEM_PROMPTS.previdenziale(avatarName, avatarTono, avatarTipo);
    } else if (mode === "marco") {
      system = SYSTEM_PROMPTS.marco;
    } else if (mode === "parser") {
      system = SYSTEM_PROMPTS.parser;
    }
    // mode === "direct": usa body.system as-is (analisi narrativa con prompt custom)

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:      "claude-sonnet-4-20250514",
        max_tokens: maxTokens || 1200,
        system,
        messages,
      }),
    });

    const data = await response.json();

    return {
      statusCode: 200,
      headers: {
        "Content-Type":                "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(data),
    };
  } catch (err) {
    console.error("Errore Claude Function:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
