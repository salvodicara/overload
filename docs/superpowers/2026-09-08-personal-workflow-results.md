# Flusso personale: preparazione, palestra e revisione

## Necessità concrete

| Necessità | Percorso e comportamento |
| --- | --- |
| Preparare la scheda a casa | Allenati → scheda → anteprima → Modifica. Serie, target, riscaldamento, recuperi, carichi, incrementi e note restano configurabili. |
| Far preparare un piano all'AI | Allenati → Importa piano → Scarica istruzioni per l'AI. Il file include formato, schema, esempio e catalogo reale degli esercizi. Si carica il file restituito dall'AI oppure si incolla il contenuto. |
| Controllare prima di aggiungere | Anteprima leggibile in un passaggio separato; esercizi, target differenti per serie, carichi ereditati, riscaldamento, recuperi e incrementi. Gli ID non riconosciuti richiedono una scelta esplicita dalla libreria. |
| Evitare danni importando | Programma aggiunto atomicamente, senza sostituire schede, storico o impostazioni. Identità derivate dal contenuto evitano duplicati al secondo tentativo e preservano le modifiche fatte dopo l'importazione. |
| Sapere cosa fare oggi | Home → prossimo allenamento → anteprima; avvio immediato da Home o Allenati. Durante la sessione gli esercizi mantengono l'ordine della scheda. |
| Consultare esecuzione e note | Toccare il nome dell'esercizio apre il dettaglio condiviso con la libreria. Tecnica e note rimangono accessibili durante la sessione; il diario collega ogni nota al relativo allenamento. |
| Sostituire un esercizio | Opzioni esercizio → Sostituisci → libreria con ricerca, muscolo, attrezzatura e uso recente. Protezione dei dati già inseriti. |
| Mettere in pausa e riprendere | Comando del cronometro; il tempo in pausa viene escluso. Sessione, valori e pausa sopravvivono alla riapertura quando il salvataggio locale riesce. |
| Sapere se i dati sono al sicuro | In caso di errore dello storage attivo compare un avviso persistente. Sparisce dopo un salvataggio riuscito. L'errore non cancella i valori in memoria. |
| Correggere sette ore in novanta minuti | Riepilogo → Vedi allenamento → Opzioni → Modifica allenamento → Durata (min) = 90 → Salva. Serie e carichi conservati; durata e ora finale aggiornate. |
| Frequenza, progressi e record | Home per settimana corrente; Profilo → Statistiche o Calendario per gli intervalli; dettaglio esercizio → Statistiche esercizio. Il ricalcolo dei record dopo modifiche usa ora la data effettiva, anche con timestamp importati discordanti. |
| Nutrizione e misure | Profilo → Nutrizione: data, calorie, proteine, carboidrati, grassi, saturi, fibre, zuccheri e sale; storico dei giorni registrati. Profilo → Misure mantiene peso e misure corporee. |
| Suono del recupero | Impostazioni → Avvisi di recupero → Prova suono; stato dei permessi e attivazione notifiche espliciti. Il limite della versione web è descritto sotto. |

## Avvisi con schermo bloccato

La PWA attuale osserva la scadenza mediante JavaScript della pagina. Il browser può sospenderlo quando l'app non è visibile; una pagina chiusa non può eseguirlo. Perciò il suono a schermo bloccato/chiuso non viene dichiarato affidabile. I test automatici dei suoni e delle notifiche usano API simulate e non equivalgono a una prova sul telefono.

Una notifica nativa programmata all'inizio del recupero è la strada appropriata per l'avviso locale a processo sospeso. Web Push richiede connessione, server e sottoscrizioni e non è un cronometro offline preciso. La scelta specifica dipende dal telefono e dai permessi. Nessun servizio esterno o involucro nativo è stato aggiunto senza chiarire il dispositivo.

Fonti ufficiali consultate:
- [Ciclo di vita delle pagine Chrome](https://developer.chrome.com/docs/web-platform/page-lifecycle-api)
- [Web Push per le app Home Screen su iPhone e iPad](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
- [Apple: notifiche locali programmate](https://developer.apple.com/library/archive/documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/SchedulingandHandlingLocalNotifications.html)
- [Apple: AlarmKit](https://developer.apple.com/videos/play/wwdc2025/230/)
- [Android: programmazione degli allarmi](https://developer.android.com/develop/background-work/services/alarms)
- [Android: limiti Doze](https://developer.android.com/training/monitoring-device-state/doze-standby)

## Pattern di riferimento

[Hevy: preparazione e registrazione](https://www.hevyapp.com/features/track-workouts/), [Hevy: pausa e durata](https://help.hevyapp.com/hc/en-us/articles/34513981310615-How-to-I-adjust-duration-and-pause-a-workout), [Strong: recupero](https://help.strongapp.io/article/231-rest-timer), [StrengthLog: creare un programma](https://help.strengthlog.com/help-article/how-to-build-a-program/).

L'importazione AI usa il normale pattern file → validazione → anteprima → conferma, con aggiunta separata dal ripristino completo dei backup. L'AI esterna non riceve automaticamente dati dell'account.

## Nutrizione: dati completi senza perdite

Gli otto valori giornalieri accettano decimali e zero; il campo vuoto indica un dato non registrato. Si può scegliere una data passata e richiamarla dallo storico. Il salvataggio transazionale legge e aggiorna il record nella stessa operazione, evitando che due campi compilati rapidamente si sovrascrivano. Backup precedenti con sole calorie/proteine rimangono validi; tutti i nuovi valori vengono conservati in esportazione e reimportazione. Date impossibili, numeri negativi o non finiti sono respinti. Gli obiettivi non vengono più cancellati da un input non valido.

Questa superficie registra totali giornalieri; non include ancora alimenti, porzioni, pasti o barcode. La domanda sul diario alimentare rispetto ai totali e quella sul telefono sono ancora in attesa di risposta. Nessuna scelta dipendente da quelle risposte viene considerata approvata dal solo trascorrere del tempo.

## Verifiche

- `pnpm test`: 297 test in 38 file superati.
- `pnpm e2e`: 110 scenari superati nella suite completa finale. Corretto un test preesistente che misurava la geometria prima della fine di una cancellazione asincrona; verificato anche cinque volte consecutive.
- `pnpm build`: TypeScript, bundle di produzione e service worker completati; 514 chiavi IT/EN allineate.
- Controlli visivi aggiuntivi: 20 catture a 320/390 px, italiano/scuro e inglese/chiaro, per importazione, anteprima, errore di abbinamento esercizio, avvisi e nutrizione. Nessun overflow orizzontale o chiave non tradotta rilevato; immagini ispezionate. Si aggiungono ai controlli delle superfici della revisione precedente.
- Revisione indipendente di parser/store/importazione, timer e nutrizione. Corretti il carico ereditato nell'anteprima, la concorrenza nella lettura dei file, il salvataggio simultaneo dei nutrienti e la cancellazione involontaria degli obiettivi.
- Regressioni verificate prima in errore e poi corrette per cronologia dei record, date nutrizionali impossibili e input degli obiettivi.

Log e immagini locali: `/Users/salvatoredicara/Workspace/Codex/overload-qa` e log `personal-*`/`nutrition-*` nella directory Codex. Verifiche con account e dati sintetici; nessuna modifica ai dati personali o pubblicazione.
