# LiraTime

En webbapp för personlig tidsregistrering med lokal lagring i webbläsaren. Upplägget följer Mac-appens vänsterspalt och lodräta tidslinje.

## Öppna på webben

[Öppna LiraTime](https://andreassvensson87-dev.github.io/LiraTimeWeb/). Ingen installation behövs.

För att flytta registreringar från localhost: exportera en JSON-säkerhetskopia under **Sparas lokalt**, öppna webbadressen och återställ säkerhetskopian där. Adresserna har separat lagring och synkroniseras inte.

GitHub Actions kör kontroller och tester vid push till `main` och publicerar därefter `site` på GitHub Pages.

## Starta

Dubbelklicka på **Starta LiraTime.command** på den här Macen. Startfilen använder systemets Node.js, annars den version som följer med Codex. Behåll terminalfönstret öppet och besök **http://localhost:5187**.

Med Node.js 20 eller senare installerat kan du också köra `npm start`. Inga paket behöver installeras. `npm test` kör testerna.

## Uppdatera appen

Appen söker automatiskt vid start, när fönstret får fokus och var femtonde minut. Knappen **Uppdatera appen** visas längst ned i vänsterspalten enbart när en ny version finns. Uppdatering sker först när du klickar och blockeras om ett formulär är öppet eller en ändring håller på att sparas. Pågående klocka och sparade uppgifter behålls.

`npm run build` skapar publiceringsmappen `site` med versionsmärkta programfiler så att en ny release inte blandas med gamla cachade filer.

## Tre vyer

### Tidslinje

Tidslinjen fyller arbetsytan. Välj dag med datumväljaren eller pilarna.

- Klicka **play** vid ett projekt i vänsterspalten för att börja. Ett annat projekt avslutar det pågående passet och startar nästa utan mellanrum.
- Stoppa med fyrkanten. Kommentarer skrivs i vänsterspalten under den pågående klockan och sparas automatiskt när du skriver.
- Klicka på ett projektnamn för att välja det som förval när du lägger till tid manuellt.
- Dra över tom tid för att markera ett intervall; välj projekt och skriv kommentar i formuläret.
- Dra ett sparat block för att flytta det eller dra över-/underkanten för att ändra start/slut. Femminuterssteg, med skydd mot överlappning. Du kan också lägga in tid längre fram på dagen eller på kommande dagar. Framtida registreringar ingår i summeringen.
- Klicka på ett block för exakta tider och kommentar. **Ångra tidsändring** återställer senaste drag- eller tangentbordsändringen under sessionen.
- Tangentbord: Tab fokuserar block, Enter öppnar redigering, upp/ned flyttar, Skift + upp/ned ändrar slut, Alt + upp/ned ändrar start. Escape avbryter drag.
- Mobil: **Rita tid** aktiverar markering av tom tid. Stäng av för att bläddra. Block kan dras direkt.

På pågående pass kan starttiden ändras genom att dra överkanten eller använda Alt + pil upp/ned. Klockan fortsätter gå. Starttiden begränsas av föregående registrering och aktuell tid. För pass över midnatt ändras starten på den dag där passet började. Pass över midnatt delas mellan dagarna i visningen. Flytta hela sådana pass via formulärets datumfält. Sommartidsdygn visas med 23 eller 25 timmar och tidszon vid upprepade timmar.

### Projekt

Skapa projekt och redigera namn/färg. Arkivering gömmer projektet från startlistan och behåller samtliga registreringar och kommentarer. Ett pågående pass avslutas vid arkivering (knappen heter då **Stoppa och arkivera**). Projekt kan återaktiveras under **Arkiverade**. Det går att arkivera alla projekt; skapa eller återaktivera ett projekt för att registrera ny tid.

### Summering

Klicka på en dag i månadskalendern för att se dagens summering. Dagar med registrerad tid markeras med en prick. Bläddra mellan månader med pilarna eller välj **Till idag**. Du kan även välja datumintervall, **Idag** eller **Den här veckan**. Visar total tid, grupperat per dag och projekt, och varje registrerings kommentar inklusive radbrytningar. Arkiverade projekt ingår. Datumrubriken öppnar dagen i tidslinjen; pennan öppnar registreringen för redigering. CSV-export gäller den valda perioden och inkluderar kommentarerna. Högst ett år kan visas åt gången.

## Valfri tidsfil på hårddisken

Under **Sparas lokalt** kan du välja **Spara till ny fil** för att kopiera nuvarande uppgifter till en JSON-fil, eller **Öppna tidsfil** för att läsa en befintlig fil. Öppning ersätter webbläsarens uppgifter efter bekräftelse. Därefter sparas ändringar både i webbläsaren och i filen. Filnamn och sparstatus visas i samma meny.

Appen kommer ihåg vald fil i samma webbläsare och på samma webbadress. Efter omladdning ansluts filen automatiskt om åtkomsten fortfarande är godkänd och uppgifterna stämmer med webbläsarkopian. Annars visas **Anslut sparad fil**, där du kan godkänna åtkomsten utan att välja fil igen. Om uppgifterna skiljer sig åt får du välja mellan **Läs in filens uppgifter** och **Spara webbläsarens uppgifter i filen**, med bekräftelse före ersättning. Utan ansluten fil fungerar webbläsarlagringen som tidigare. **Koppla från fil** glömmer filvalet, behåller uppgifterna och fortsätter med enbart webbläsarlagring. Direkt fillagring kräver Chrome eller Edge på datorn.

Om filen inte kan sparas behålls ändringarna i webbläsaren och en varning visas. Om filen har ändrats utanför appen stoppas filskrivningen. Spara då webbläsarens version till en ny fil, eller öppna den externa filen om den ska ersätta webbläsarens version. Filen är inte avsedd för samtidig redigering från flera datorer.

## Lagring och säkerhetskopiering

Projekt, kommentarer, avslutade registreringar och den pågående klockans starttid sparas i webbläsarens **localStorage**, nyckel `liratime.v1`. Samma adress, port och webbläsarprofil behövs för att komma åt samma uppgifter. Klockan fortsätter räknas när fliken är stängd eller datorn sover, tills den stoppas.

Under **Sparas lokalt** i vänsterspaltens nederkant finns JSON-säkerhetskopiering och återställning. Återställning ersätter befintlig data efter bekräftelse. Gamla säkerhetskopior utan arkiveringsfält fungerar fortfarande. Privat läge, rensad webbplatsdata eller en förlorad dator kan innebära förlorade uppgifter; ta säkerhetskopior regelbundet.

Appen kan öppnas via GitHub Pages eller serveras på den egna datorn. Ingen inloggning, serverdatabas eller molnsynk används. Google Fonts används med lokala reservtypsnitt. Tidsdata skickas inte till externa tjänster. Backupfiler krypteras inte av appen.
