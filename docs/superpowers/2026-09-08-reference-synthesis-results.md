# Sintesi Hevy, Strong e StrengthLog

Questa revisione sostituisce la precedente organizzazione a cinque sezioni. La richiesta è usare pattern esistenti verificati, adattando lo stile di Overload.

## Provenienza delle scelte

| Superficie | Pattern ripreso | Implementazione |
| --- | --- | --- |
| Home | StrengthLog: programma/prossimo allenamento, riepiloghi e ultimi allenamenti | Ripresa o prossimo allenamento, settimana corrente con accesso alle statistiche, tre sessioni recenti collegate al diario unico |
| Allenati | Hevy e Strong: schede riutilizzabili in cartelle, avvio ed editor | Conservati cartelle, schede, creazione/modifica e registrazione delle serie già presenti |
| Profilo | Hevy: centro personale con statistiche, esercizi, misure, calendario e sessioni | Identità/riepilogo, accessi diretti, cinque sessioni recenti; un unico dettaglio per ogni allenamento |
| Impostazioni | Hevy: accesso tramite ingranaggio dal Profilo | Preferenze, esportazione/importazione, sincronizzazione e account separati dal diario personale |
| Statistiche | Hevy/Strong: analisi degli allenamenti e prestazioni per esercizio | Pagina interna con intervalli, metriche, grafici e collegamenti esistenti dal dettaglio esercizio |
| Misure e nutrizione | Hevy per le misure; Strong per calorie/proteine e obiettivi personali | Pagine interne separate, riutilizzando registrazione, grafici e cronologia esistenti |

La barra principale contiene **Home, Allenati, Profilo**. La Home di StrengthLog sostituisce esplicitamente il feed sociale di Hevy, che non serve all'uso personale di Overload. È una sintesi dei riferimenti, non una replica integrale di una sola app.

Fonti ufficiali verificate:
- [Hevy: organizzazione e utilizzo](https://www.hevyapp.com/hevy-tutorial/)
- [Hevy: Profilo e progressi](https://www.hevyapp.com/features/gym-progress/)
- [Hevy: schede e cartelle](https://www.hevyapp.com/features/gym-routines/)
- [Strong: dashboard personale](https://help.strongapp.io/article/239-profile-widgets)
- [Strong: schede](https://help.strongapp.io/article/105-about-templates)
- [StrengthLog: Home](https://help.strengthlog.com/help-article/the-home-screen/)

## Cura visiva e interazioni

- Intestazioni compatte nelle pagine interne, con pulsante Indietro; titoli marcati nelle tre sezioni principali.
- Etichette italiane/inglesi leggibili a 320 px; “Measures” riprende il nome breve di Hevy.
- Un solo accesso completo allo storico nella Home popolata; anteprime e calendario aprono lo stesso allenamento.
- Calendario dal Profilo apre la modalità corretta anche dopo aver usato la lista.
- Impostazioni separate da dati personali, senza doppio titolo della sezione.
- Linee dei grafici con colore accessibile nel tema chiaro; tema scuro invariato.
- Palette grafite/volt, Archivo e componenti esistenti mantenuti.

## Verifica

36 schermate aggiornate (9 destinazioni × italiano scuro/inglese chiaro × 320/390 px), più Home desktop. Nessun overflow di pagina o chiave di traduzione visibile. Revisione visiva indipendente e correzione dei difetti osservati. I flussi di allenamento/editor già verificati nella revisione precedente restano coperti dalla suite completa.

- 257 test unitari superati, 33 file.
- Build di produzione, TypeScript e parità delle 447 traduzioni superati.
- 100 test Playwright superati su 100 (2,7 minuti), inclusi ritorno dai dettagli e modalità calendario dal Profilo.

Dati usati per le verifiche sintetici. Schermate in `~/Workspace/Codex/overload-qa/synthesis-*.png`. Verifica locale Chromium; Safari su dispositivo reale e sincronizzazione di produzione non verificati in questa attività. Branch `codex/hevy-ux-review`, nessuna pubblicazione in produzione.
