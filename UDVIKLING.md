# Udvikling og udgivelse af Strikkemønstre

Denne vejledning forklarer, hvordan appen er bygget, hvordan du ændrer og tester
den lokalt, og hvordan en ny udgave lægges på GitHub, så den når ud til
telefonen.

- **Live-adresse:** <https://welander071290.github.io/strik/>
- **GitHub-repository:** <https://github.com/welander071290/strik>
- **Lokal mappe:** `HA-dashboard\strik-app` (denne mappe)

---

## 1. Overblik

Appen er en *Progressive Web App* (PWA): en almindelig hjemmeside, som iPhonen
kan lægge på hjemmeskærmen og bruge offline. Der er ingen server-del og ingen
byggetrin – filerne lægges ud præcis som de er.

```
GitHub (main-branch) ──► GitHub Pages (https) ──► iPhone (Safari / hjemmeskærm)
        ▲                                                 │
        │ git push                                        │ gemmer appen offline
        │                                                 ▼ (service worker)
   denne mappe på PC'en                          mønstre i telefonens lager
```

### Filer

| Fil | Formål | Udgives |
|---|---|---|
| `index.html` | Hele appen: HTML, CSS og JavaScript i én fil | Ja |
| `sw.js` | Service worker – gør appen offline og henter opdateringer | Ja |
| `manifest.json` | Navn, ikon og visning når appen lægges på hjemmeskærmen | Ja |
| `icon-180.png`, `icon-512.png` | App-ikoner | Ja |
| `.nojekyll` | Får GitHub Pages til at udgive filerne uændret | Ja |
| `serve.js` | Lille lokal testserver (Node.js) | Ligger i repo, bruges kun lokalt |
| `iphone15.html` | Forhåndsvisning i iPhone 15-størrelse (393×852) | Ligger i repo, bruges kun lokalt |
| `UDVIKLING.md` | Denne vejledning | Ja |

### Hvor gemmes data?

Mønstrene gemmes **kun på telefonen** i browserens `localStorage` – aldrig på
GitHub. Koden er offentlig, data er privat.

| Nøgle | Indhold |
|---|---|
| `strik.lib` | Alle mønstre: `{ id: {id, name, w, h, bg, cells[], row, updated, thumb} }` |
| `strik.currentId` | Id på det mønster, der sidst var åbent |
| `strik.prefs` | Indstillinger: værktøj, farve, zoom, seneste farver, favoritter, strikke-tilstand m.m. |

Lageret er knyttet til *adressen* (origin). `https://welander071290.github.io`
har derfor sin egen samling, adskilt fra fx `localhost:8765`.

> ⚠️ **Bevar dataformatet.** Ændrer du strukturen i `strik.lib` eller
> `strik.prefs`, skal gamle data stadig kunne læses (giv nye felter en
> standardværdi, ligesom `prefs` gør med `Object.assign({...standard}, gemt)`).
> Ellers kan hendes eksisterende mønstre gå i stykker efter en opdatering.

### Sådan kommer opdateringer ud til telefonen

`sw.js` bruger strategien *stale-while-revalidate*:

1. Appen åbner **straks** fra den kopi, der er gemt på telefonen.
2. Samtidig hentes den nyeste udgave fra GitHub i baggrunden og gemmes.
3. Er `index.html` ændret, viser appen knappen **"✨ Ny version klar – tryk for
   at opdatere"**. Trykker hun på den, gemmes mønstret og appen genindlæses.
   Ellers bruges den nye udgave næste gang appen startes.

GitHub Pages sender filerne med `Cache-Control: max-age=600`, så der kan gå op
til ca. 10 minutter (+ 1–2 minutter til udgivelse), før telefonen ser ændringen.

---

## 2. Forudsætninger (én gang)

- **Git** (installeret).
- **Node.js** (installeret) – kun til den lokale testserver.
- **VS Code** med denne mappe åben.
- Repository'et er sat op til at bruge den private GitHub-konto:

  ```powershell
  git remote -v
  # origin  https://welander071290@github.com/welander071290/strik.git
  git config user.name    # welander071290
  git config user.email   # welander071290@users.noreply.github.com
  ```

  Brugernavnet står i remote-adressen, så Git Credential Manager vælger
  kontoen **welander071290** og ikke arbejdskontoen (AndersWelanderBR), som
  også er gemt på PC'en. Identiteten er sat *kun for dette repository*, så
  ABB-mailen ikke kommer med i historikken.

---

## 3. Arbejdsgang for en opdatering

### Trin 1 – Hent seneste udgave

Hvis der kan være ændringer fra en anden PC eller direkte på github.com:

```powershell
cd "C:\Users\DKANWEL\OneDrive - ABB\Documents\VSCode projects\HA-dashboard\strik-app"
git pull
```

### Trin 2 – Start den lokale testserver

```powershell
node serve.js
```

Serveren skriver de adresser, den kan nås på, fx:

```
http://localhost:8765
http://192.168.1.152:8765
```

- **På PC'en:** <http://localhost:8765/>
- **iPhone 15-forhåndsvisning:** <http://localhost:8765/iphone15.html>
  (knapperne "↻ Drej" og "⟳ Genindlæs" findes øverst)
- **På en telefon på samme wifi:** `http://<PC'ens IP>:8765/index.html`
  (kun http – offline og "Hold skærmen tændt" virker derfor ikke her)

Stop serveren med `Ctrl+C`.

> 💡 På `localhost` er service workeren aktiv, ligesom på GitHub. Efter en
> ændring viser første genindlæsning derfor den *gamle* udgave, og knappen
> "Ny version klar" dukker op. Genindlæs én gang til, eller tryk på knappen.
> Alternativt: DevTools (F12) → Application → Service workers →
> "Update on reload".

### Trin 3 – Lav ændringen

Næsten alt ligger i `index.html`:

| Sektion i filen | Indhold |
|---|---|
| `<style>` | Layout. Bemærk `@media (orientation:portrait)` (fanebjælke i bunden) og `@media (max-height:520px)` (liggende telefon) |
| `<nav id="rail">` / `<div id="drawer">` | Fanebjælken og skufferne (Farve, Værktøj, Mere) |
| `<div class="sheet" …>` | Vinduerne: farver, størrelse, forhåndsvisning, filer |
| `/* Farvedata */` | RAL-, pastel- og garnfarver |
| `/* Visning … */` + `render()` | Tegning af gitteret, zoom og gentagelse |
| `cv.addEventListener('pointerdown' …)` | Berøring: tegne, pinch-zoom, flytte |
| `/* Strikke-tilstand */` | Låst tilstand med rækketæller |
| `/* Hold skærmen tændt … */` | Wake Lock og gem ved lukning |
| `/* Start */` | Opstart og registrering af service worker |

**Tilføjer du en ny fil**, som appen skal bruge offline (fx et billede), skal
den også med i `FILES`-listen øverst i `sw.js`.

### Trin 4 – Test

Gennemgå mindst dette i iPhone 15-forhåndsvisningen – både stående og
liggende:

- [ ] Appen åbner uden fejl (F12 → Console er tom for røde fejl).
- [ ] Tegn, visk ud, fyld og pipette virker; Fortryd/Gentag virker.
- [ ] Pinch-zoom og flyt med to fingre (på rigtig telefon) – ingen streger males ved et uheld.
- [ ] Fanebjælken ligger i bunden på højkant og i siden liggende.
- [ ] Alle skuffer og vinduer kan ses helt og kan scrolle (Farve → Alle farver, Mere → Størrelse, Vis mønster, Mine mønstre).
- [ ] Strikke-tilstand: rækker kan vælges, intet males.
- [ ] Eksisterende mønstre åbner stadig korrekt efter ændringen.

> ⚠️ **Chrome er ikke Safari.** Forhåndsvisningen kører i Chrome, men iPhonen
> bruger WebKit, som opfører sig anderledes ved fx flexbox (`flex:1` kan få
> skuffer til at klappe sammen – brug `flex:1 1 auto`), `height:fit-content`
> og visse CSS-enheder. Test vigtige ændringer på en rigtig iPhone via
> `http://<PC'ens IP>:8765/index.html` før udgivelse.

### Trin 5 – Bump cache-versionen (kun når det er nødvendigt)

Øverst i `sw.js`:

```js
const CACHE = 'strik-v6';
```

| Ændring | Bump versionen? |
|---|---|
| Kun `index.html` (CSS/JS/HTML) | Nej – opdateres automatisk og udløser "Ny version klar" |
| Ikoner, `manifest.json` | Ja – ellers kan gamle filer blive hængende |
| `FILES`-listen eller logikken i `sw.js` | Ja |
| Ny fil tilføjet | Ja (og tilføj den til `FILES`) |

Tæl op: `strik-v6` → `strik-v7`. Gamle caches slettes automatisk.

### Trin 6 – Commit

```powershell
git status                 # se hvad der er ændret
git diff                   # gennemse ændringerne
git add -A
git commit -m "Kort beskrivelse af ændringen"
```

Skriv beskeden, så den giver mening senere, fx
`Større knapper i strikke-tilstand` eller `Ret: skuffer klapper sammen i Safari`.

### Trin 7 – Push til GitHub

```powershell
git push
```

Første gang (eller hvis login er udløbet) åbner Git Credential Manager et
vindue: vælg **"Sign in with your browser"** og log ind som **welander071290**.

### Trin 8 – Kontroller udgivelsen

1. GitHub Pages bygger automatisk efter hvert push (typisk 1–2 minutter).
   Status ses under **Actions** i repository'et:
   <https://github.com/welander071290/strik/actions>
2. Kontroller, at den nye udgave ligger online:

   ```powershell
   $r = Invoke-WebRequest "https://welander071290.github.io/strik/index.html?x=$(Get-Random)" -UseBasicParsing
   $r.StatusCode                               # 200
   $r.Content.Contains("en tekst fra din ændring")  # True
   ```

3. Åbn appen på telefonen. Inden for ca. 10 minutter dukker
   **"✨ Ny version klar"** op – tryk på den.

---

## 4. Fortryd en dårlig udgivelse

Hurtigste vej tilbage er at lave en ny commit, der fortryder den forrige:

```powershell
git log --oneline -5        # find den commit, der skal fortrydes
git revert <commit-id>      # laver en ny commit, som fjerner ændringen
git push
```

Brug **ikke** `git push --force` – historikken skal bevares.

---

## 5. Fejlfinding

| Problem | Løsning |
|---|---|
| `Permission to welander071290/strik.git denied to AndersWelanderBR` (403) | Git bruger arbejdskontoen. Tjek at remote indeholder brugernavnet: `git remote set-url origin https://welander071290@github.com/welander071290/strik.git` og push igen. |
| `Cannot prompt because user interactivity has been disabled` | Kør `git push` i en almindelig VS Code-terminal (Terminal → New Terminal), så login-vinduet kan vises. |
| Telefonen viser ikke den nye udgave | Vent 10–15 min. Luk appen helt (stryg op i app-skifteren) og åbn igen – første åbning henter, anden viser. Tjek også trin 8. |
| Siden på GitHub viser 404 | Tjek **Settings → Pages**: Source = *Deploy from a branch*, Branch = `main` / `(root)`. Se fejl under **Actions**. |
| `warning: LF will be replaced by CRLF` | Ufarligt – Git normaliserer linjeskift. Filen på GitHub er lidt mindre end lokalt af samme grund. |
| Mønstre forsvundet efter opdatering | Dataformatet er sandsynligvis ændret uden bagudkompatibilitet (se afsnit 1). Lav en `git revert`, og ret indlæsningen, så gamle data accepteres. |
| Skuffer/vinduer ser forkerte ud kun på iPhone | WebKit-forskel – se advarslen i trin 4. |

---

## 6. Godt at vide

- **Mønstrene er ikke en del af udgivelsen.** En opdatering rører aldrig
  hendes mønstre – medmindre koden, der læser dem, ændres forkert.
- **Backup af mønstre** sker i appen: ⚙️ Mere → Mine mønstre →
  *Eksportér fil* / *Importér fil*.
- **Repository'et skal være offentligt** for at gratis GitHub Pages virker.
  Læg derfor aldrig adgangskoder, tokens eller private data i mappen.
- **Home Assistant bruges ikke længere** til appen. Den tidligere kopi i
  `/config/www/strik/` er fjernet.
