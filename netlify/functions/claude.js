// netlify/functions/claude.js — versione ottimizzata con modelli ibridi
// Haiku (~20x più economico) per task semplici, Sonnet per analisi complesse

const SONNET = "claude-sonnet-4-20250514";
const HAIKU  = "claude-haiku-4-5-20251001";

// Mappa mode → modello ottimale
const MODEL_MAP = {
  parser:        HAIKU,   // estrazione JSON dal testo → semplice
  marco:         HAIKU,   // bio Marco Buzzoni → fattuali, brevi
  previdenziale: SONNET,  // analisi narrativa + chat → ragionamento complesso
  direct:        SONNET,  // analisi custom con prompt completo
};

const SYSTEM_PROMPTS = {

  previdenziale: (avatarName, avatarTono, avatarTipo) =>
    `Sei ${avatarName}, assistente AI esperto di previdenza italiana con approccio ${avatarTono}. ` +
    `Profilo investitore: ${avatarTipo}. ` +
    `NON menzionare mai R.I.T.A. NON usare mai "Caro/Gentile cliente". ` +
    `Cita solo fonti ufficiali: COVIP, Agenzia delle Entrate, INPS, Banca d'Italia, CONSOB, IVASS, D.Lgs. 252/2005. ` +
    `Non fornire piani operativi dettagliati. ` +
    `Per domande sulla situazione specifica, dai info generali e lascia intendere che la risposta precisa richiede un confronto diretto. ` +
    `Call gratuita con Marco Buzzoni disponibile.`,

  marco:
    `Sei l'assistente AI personale di Marco Buzzoni, consulente finanziario. ` +
    `Rispondi SOLO con informazioni reali basandoti sui dati forniti. Se non presente, dillo onestamente. ` +
    `STILE: discorsivo e narrativo, MAI elenchi puntati, paragrafi fluidi, max 120 parole.\n` +
    `PROFILO:\n` +
    `CARRIERA: Inizia nel 2006 in Deutsche Bank zona Lecco. 2010 (25 anni): Direttore di Sportello, il piu giovane della zona. ` +
    `2015: lascia per P.IVA con Azimut Capital Management. Ufficio Via Balicco 101, Lecco. Segue ~100 famiglie tra Lecco, Monza e Milano.\n` +
    `FORMAZIONE: Liceo Scientifico Don Gnocchi. Laurea Magistrale Scienze Bancarie Finanziarie Assicurative, Cattolica del Sacro Cuore.\n` +
    `SPECIALIZZAZIONI: Previdenza complementare (dal 2007), asset allocation, polizze vita, trasmissione patrimoniale.\n` +
    `METODO: Ascolto prima di qualsiasi proposta. Ha lasciato la banca rifiutando di imporre prodotti. Visione di lungo periodo.\n` +
    `PREVIDENZA: Fondi pensione dal 2007. Preferisce fondi aperti. Welfare aziendale per scuola (TFR nel fondo + 4% contributo datore).\n` +
    `PERSONA: 41 anni, zona Lecco. Volontario in scuola dell'infanzia e circolo scacchi.\n` +
    `DIFFERENZE: No obiettivi commerciali imposti. 19 anni esperienza di cui 10 come indipendente.`,

  parser:
    `Sei un estrattore JSON. Risposta: SOLO JSON valido, nessun testo extra, nessun markdown.`,
};

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const body = JSON.parse(event.body);
    const { mode, messages, avatarName, avatarTono, avatarTipo, maxTokens } = body;

    // Seleziona modello e system prompt in base alla modalità
    const model = MODEL_MAP[mode] || SONNET;

    let system = body.system || "";
    if (mode === "previdenziale" && avatarName) {
      system = SYSTEM_PROMPTS.previdenziale(avatarName, avatarTono, avatarTipo);
    } else if (mode === "marco") {
      system = SYSTEM_PROMPTS.marco;
    } else if (mode === "parser") {
      system = SYSTEM_PROMPTS.parser;
    }
    // mode === "direct": usa body.system as-is

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
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
