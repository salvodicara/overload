# Diario alimentare guidato

## Cosa cambia

Profilo → Nutrizione apre un diario con data, riepilogo calorie/proteine/carboidrati/grassi e quattro gruppi familiari: Colazione, Pranzo, Cena, Spuntini. Aggiungi alimento → ricerca o barcode → alimento → quantità in grammi/millilitri → anteprima → aggiungi. Toccare una voce permette di correggere quantità/pasto o eliminarla con conferma.

Gli alimenti recenti sono riutilizzabili. Salva pasto conserva un gruppo di alimenti; Pasti salvati permette di aggiungerlo un altro giorno o pasto, anche in frazioni/multipli. Eliminare un pasto salvato non modifica le voci già consumate. Un alimento non trovato si può creare dall'etichetta, con valori per 100 g/100 ml e micronutrienti facoltativi.

Importa diario accetta JSON/CSV tramite file o testo incollato. Formato ed esempio scaricabili; nessuna integrazione o generazione AI. Un'anteprima con date, pasti, quantità, fonte e nutrienti precede l'aggiunta atomica. ID sconosciuti, date impossibili e quantità non valide sono respinti. Il secondo invio delle stesse righe non le duplica. I totali rapidi preesistenti restano una voce manuale distinta quando si aggiungono alimenti, evitando cancellazioni implicite.

## Pattern riutilizzati

- [Cronometer: aggiunta alimento](https://support.cronometer.com/hc/en-us/articles/360018193011-Add-a-Food): ricerca → quantità → gruppo del diario.
- [MacroFactor: pasti salvati](https://help.macrofactorapp.com/en/articles/239-save-a-meal-for-later-use): raggruppare alimenti e riutilizzarli.
- [Cronometer: fonti e completezza](https://support.cronometer.com/hc/en-us/articles/360018239472-Data-Sources): separare composizione degli alimenti generici dai soli dati di etichetta.

Stile, componenti, intestazioni, accento e controlli di Overload preservati. Dettagli nutrizionali secondari espandibili; nessuna nuova scheda nella barra principale.

## Dati e limiti verificati

- 7.793 alimenti USDA SR Legacy, circa 4 MB JSON, senza chiavi API. Fonte in pubblico dominio e generazione riproducibile documentate in `docs/food-catalog-sources.md`. Verifica indipendente di 170.853 valori mappati: nessuna differenza rispetto all'archivio originale.
- Ricerca locale con sinonimi italiani; 21 nomi comuni tradotti esattamente. Molte descrizioni della fonte restano in inglese: non viene dichiarata la traduzione completa del database. Preparazione cotto/crudo conservata nel nome; nessuna conversione di densità inventata.
- Open Food Facts barcode verificato dal browser con CORS e richiesta reale. Base 100 g/100 ml esplicita; conversioni delle unità nutrizionali verificate. Dati stimati dal provider, limiti tipo min/max, valori negativi/non finiti e unità non supportate sono esclusi.
- La ricerca testuale online dei marchi non viene esposta: il servizio attuale del provider non consente CORS dal browser. Prodotti confezionati tramite barcode oppure inserimento dell'etichetta.
- La scansione fotocamera usa BarcodeDetector quando disponibile. Il permesso viene richiesto solo dal comando Scansiona; flusso video chiuso all'uscita/errore. Numero del barcode inseribile manualmente. Il funzionamento fisico della fotocamera sul telefono personale non è stato verificato.
- Il catalogo viene memorizzato dal service worker dopo il primo caricamento online; voci recenti e pasti salvati rimangono locali. Primo download catalogo e barcode richiedono connessione.
- 25 nutrienti con valori assenti distinti dallo zero e subtotali parziali dichiarati. Le voci contengono copie dei valori originali: aggiornare il catalogo non riscrive lo storico. I file con valori personalizzati sono esplicitamente dati forniti dall'importazione.
- Nessun servizio AI, proxy o backend a pagamento, nessuna pubblicazione o modifica ai dati reali.

## Esercizi e allarme

La navigazione non è stata modificata in questo passaggio. Profilo → Esercizi è un collegamento principale in alto: due tocchi dalle altre sezioni principali. Durante la sessione il nome dell'esercizio apre direttamente tecnica e note. La precedente sintesi Home/Allenati/Profilo concentra registrazione nella barra e consultazione nel Profilo; costa un tocco aggiuntivo per esplorare la libreria rispetto a una scheda dedicata.

L'utente usa Android con PWA installata e ha scelto di provare gli avvisi prima di intervenire. Nessuna modifica all'allarme o confezionamento nativo in questo passaggio.

## Verifiche

- 344 test unitari in 42 file superati.
- 115 scenari end-to-end superati nella suite completa finale, inclusi creazione/modifica/eliminazione, pasti salvati, importazione ripetuta, barcode in millilitri e completamento tardivo del salvataggio dopo la navigazione.
- Build TypeScript/Vite/PWA riuscita; 626 chiavi IT/EN allineate.
- 36 catture finali a 320/390 px IT/scuro ed EN/chiaro: diario, nutrienti, ricerca, quantità, alimento personalizzato, pasti salvati, conferma eliminazione, importazione e anteprima. Nessun overflow orizzontale o chiave di interfaccia non tradotta; immagini ispezionate.
- Revisione indipendente del dominio, isolamento account, importazioni, provenienza e UI. Corretti input numerici che potevano interrompere il rendering, selezioni sostituite da risposte barcode tardive, navigazione tardiva dopo salvataggio, subtotali incompleti non segnalati e invio di copie obsolete dopo importazione.

Artefatti e log sotto `/Users/salvatoredicara/Workspace/Codex`; immagini e resoconti QA in `overload-qa/food-*` e `overload-qa/personal-*`. Dati di test sintetici.
