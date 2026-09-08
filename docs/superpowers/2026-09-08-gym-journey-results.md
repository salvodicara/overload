# Revisione dei percorsi in palestra e fuori

## Criterio

La domanda guida è «cosa devo riuscire a fare, con poca attenzione e senza perdere il lavoro?». La valutazione parte dai compiti e dai pattern documentati di Hevy, Strong e StrengthLog. Mantiene Home, Allenati e Profilo definiti nella [sintesi dei riferimenti](2026-09-08-reference-synthesis-results.md).

È una revisione esperta con prove nel browser, non uno studio con utenti reali: non attribuisce punteggi di usabilità o tempi di esecuzione inventati. I due controlli indipendenti sono stati raccolti separatamente: A sui percorsi e le euristiche; B sulle evidenze tecniche e le interazioni. Il secondo risultato è stato letto dopo la conclusione del primo.

## Compiti e correzioni

| Momento / intenzione | Attrito osservato | Comportamento finale |
| --- | --- | --- |
| Prima: vedere cosa prevede la scheda | Home aveva un titolo inerte; Allenati apriva direttamente l'editor con salvataggio automatico | Home e Allenati aprono la stessa anteprima, con prescrizioni, recuperi, preparazione, note e accessi agli esercizi. Avvio e Modifica sono espliciti. Le serie uguali sono riassunte; i target diversi rimangono distinti. |
| Prima: modificare la scheda | Non era visibile se le modifiche fossero state salvate | Stato locale Salvando/Salvato/Errore, Riprova e Fine. Avvio aspetta gli ultimi salvataggi; Fine resta disabilitato durante il salvataggio. |
| Durante: segnare una serie | Buona base già presente: valori precedenti, input numerici, spunta e recupero | Conservati i controlli rapidi. Nessuna conferma per una normale serie o per righe previste mai modificate. |
| Durante: terminare | Valori digitati su serie non spuntate venivano esclusi senza avviso | Revisione solo quando ci sono righe modificate non spuntate; possibilità di continuare oppure salvare esplicitamente le sole serie completate. Il flag di modifica sopravvive al riavvio. |
| Durante: macchina occupata, cambio esercizio | Sostituzione e rimozione potevano cancellare serie o nota della sessione senza avviso | Protezione quando esistono serie registrate/modificate o note; annullamento conserva i dati e restituisce il focus al comando dell'esercizio. |
| Durante: trovare un'alternativa | Catalogo alfabetico molto ampio; solo ricerca e filtro muscolare | Filtro per attrezzatura e ordinamento per uso recente, mantenuti dopo aver aperto un risultato. Nessun ordinamento basato su suggerimenti inventati. |
| Durante: consultare una nota | Lo stesso segnaposto compariva su ogni esercizio anche senza contenuto | Il comando Tecnica e note resta disponibile; l'anteprima testuale appare solo quando contiene davvero una nota. |
| Durante: pausa e interruzioni | Il comando pausa aveva un'area alta 32 px | Area minima portata a 44 px. Ripresa, valori precedenti e persistenza della sessione conservati. |
| Dopo: salvare con un errore locale | Mancava un messaggio che spiegasse come recuperare | Errore vicino all'intestazione; sessione mantenuta e nuovo tentativo con Termina. |
| Dopo: decidere se cambiare la scheda | Il riepilogo mostrava solo il numero di categorie modificate | Confronto Prima/Dopo con esercizi, posizione, numero di serie e recupero; rimozioni esplicite. |
| Dopo: controllare o correggere ciò che ho registrato | Il riepilogo conduceva solo alla Home | Vedi allenamento apre il dettaglio canonico, da cui è disponibile la modifica. |
| Fuori: verificare i progressi di un esercizio | Il collegamento apriva prima grafici generali non richiesti | Statistiche esercizio porta direttamente alla sua sezione. L'accesso generale dal Profilo mantiene il riepilogo completo. |
| Fuori: scegliere il prossimo allenamento dopo un'importazione | L'ordine poteva seguire il timestamp di importazione anziché la data effettiva | Lo stesso comparatore cronologico dello storico determina l'ultimo allenamento e la scheda successiva. |

## Principi applicati

- Riconoscimento: nomi espliciti e anteprima della prescrizione prima dell'azione.
- Visibilità dello stato: salvataggio locale, sessione attiva e conseguenze di Termina.
- Prevenzione e recupero: conferme proporzionate ai dati che verrebbero scartati, annullamento e recupero del focus.
- Coerenza: stessi dettagli per le stesse entità, stessa anteprima da Home e Allenati, nessuna nuova destinazione principale.
- Efficienza: consultazione diretta, filtri standard, niente richieste aggiuntive nel normale flusso di registrazione.
- Gerarchia: prescrizioni uniformi compatte, note vuote alleggerite, informazioni secondarie progressive.

## Provenienza e limiti

Riferimenti ufficiali: [Hevy, registrazione degli allenamenti](https://www.hevyapp.com/features/track-workouts/), [StrengthLog, Home](https://help.strengthlog.com/help-article/the-home-screen/), [Strong, dettaglio esercizio](https://help.strongapp.io/article/237-about-exercise-detail). Sono riferimenti di interazione adattati al prodotto personale, non una replica integrale o un riuso di asset proprietari.

Il controllo tecnico B non ha rilevato problemi col suo detector automatico; questo non equivale ad assenza di problemi di UX. La revisione ha infatti individuato rischi reali di perdita di input. Non è una certificazione WCAG completa, né una prova di utilizzo fisico con sudore, guanti o assistive technology. Dati e sessioni di verifica sono sintetici e isolati; nessuna pubblicazione o modifica dei dati reali.

## Verifica finale

- **258 test unitari**, 33 file, tutti superati.
- **104 test end-to-end**, tutti superati in un'unica esecuzione con server pulito e codice stabile (2,8 minuti).
- Build di produzione e controllo **476 chiavi** italiano/inglese superati.
- **28 catture**: anteprima, editor, allenamento, revisione Termina, protezione sostituzione, riepilogo e libreria; italiano/scuro e inglese/chiaro, 320 e 390 px. Nessun overflow orizzontale o chiave di traduzione visibile rilevata. Ulteriori catture del viewport a 320 px per verificare i filtri nativi.
- Regressioni specifiche: data effettiva degli allenamenti importati; annullamento senza perdita di serie e focus; consultazione/modifica/avvio della scheda; filtri persistenti; confronto dei recuperi Prima/Dopo; salvataggio fallito con sessione recuperata dopo reload.
- Review indipendente del codice completata: corretto il ritorno del focus segnalato; nessun altro problema bloccante individuato nel perimetro esaminato.

Evidenze locali fuori dal repository: `~/Workspace/Codex/overload-qa/journey-report.json`, `journey-*.png`; log `~/Workspace/Codex/journey-stable-e2e.log`, `journey-unit.log`, `journey-build.log`. I risultati precedenti interrotti dal ricaricamento del codice non sono usati come prova di superamento.

La revisione è sul branch `codex/hevy-ux-review`, senza merge o pubblicazione.
