# Fișă PDI Tunland G7 — Inter Cargo Grup

Aplicație independentă (PWA — Progressive Web App), instalabilă pe telefon
(atelier) și utilizabilă din browser pe desktop (birou), pentru fișa de
predare-primire vehicul și inspecția PDI. Funcționează **offline** după
prima încărcare. Generează PDF-ul direct pe dispozitiv (cu siglele ICG și
FOTON în antet) și, opțional, îl salvează automat în Google Drive + un rând
într-un Google Sheet (același stack ca la aplicația "Foton by Inter Cargo"),
cu autentificare pe bază de nume + cod PIN și administrare de conturi.

## Structura proiectului

```
index.html          — pagina principală (SPA)
style.css           — stiluri (identitate vizuală navy/steel ICG)
data.js             — CONFIG + listele de accesorii/PDI/nume (aici se editează textele)
fonts.js            — fontul DejaVu Sans (subset), pentru diacritice corecte în PDF
app.js              — inițializare, routing între taburi, control acces (sesiune)
app-form.js         — formularul (secțiunile 1-7) și legarea câmpurilor
app-signature.js    — semnătura desenată pe ecran (canvas)
app-archive.js      — arhiva locală + căutarea centrală (Drive)
app-pdf.js          — generarea PDF-ului (jsPDF), cu siglele ICG/FOTON în antet
app-sync.js         — sincronizare cu Google Apps Script (fișe, drafturi, conturi)
app-auth.js         — ecranul de logare + administrare utilizatori
sw.js               — service worker (funcționare offline)
manifest.json       — manifest PWA (instalare pe ecranul telefonului)
logo.png            — sigla Inter Cargo Grup (deja inclusă)
foton-logo.png      — sigla FOTON (deja inclusă)
icons/              — iconițele PWA (icon-192.png, icon-512.png), generate din sigla ICG
assets/             — siglele originale procesate (fundal transparent, variante icon/full)
Code.gs             — backend-ul Google Apps Script (Sheets + Drive + autentificare)
test/               — teste automate (rulează cu `node test/<fisier>.js`)
```

## Siglele ICG și FOTON

Fiecare siglă are mai multe variante, deja incluse, folosite în locuri diferite:

- **`logo.png` / `foton-logo.png`** — doar iconul (fără text), folosit în
  antetul aplicației (colț stânga sus, spațiu mic) și pe ecranul de logare.
- **`logo-full.png` / `foton-logo-full.png`** — sigla completă (icon + text,
  „Inter Cargo" / „FOTON"), varianta normală (negru/culoare), folosită în
  antetul aplicației și pe ecranul de logare (fundal deschis).
- **`logo-full-white.png`** — sigla ICG completă, varianta ALBĂ, arsă direct
  pe bannerul navy din antetul PDF-ului (fără fundal alb în spatele ei —
  sigla FOTON e deja albastru deschis pe fond alb, deci se vede bine direct
  pe navy și nu are nevoie de o variantă albă separată).

Dacă vrei să le înlocuiești (ex. variantă de logo actualizată), pune un
fișier PNG cu fundal transparent peste fișierul corespunzător, păstrând
același nume — nu trebuie schimbat nimic în cod. Pentru `logo-full-white.png`,
ai nevoie de o variantă cu tot desenul în alb (nu doar recolorat automat) —
dacă înlocuiești doar `logo-full.png` cu un logo nou, generează manual și
`logo-full-white.png` din același fișier (recolorare + fundal transparent),
altfel antetul PDF-ului va folosi în continuare varianta albă veche. Poți
regenera și iconițele PWA (`icons/icon-192.png`, `icons/icon-512.png`) cu
propriul logo, păstrând aceleași dimensiuni și nume de fișier.

## Pasul 2 — Găzduire pe GitHub Pages (exact ca la celelalte aplicații)

1. Creează un repository nou pe GitHub, ex. `fisa-pdi-tunland`.
2. Încarcă toate fișierele din acest folder (păstrează structura).
3. Settings > Pages > Deploy from branch > `main` / `root`.
4. În câteva minute aplicația e live la:
   `https://<user-ul-tau>.github.io/fisa-pdi-tunland/`
5. Pe telefon: deschide linkul în Chrome/Safari > „Adaugă pe ecranul
   principal" — se instalează ca o aplicație obișnuită, cu iconiță.

## Pasul 3 — Backend Google Apps Script (salvare în Sheets + Drive + logare)

Acest pas e **opțional** pentru fișe/PDF (aplicația funcționează și fără el,
fiecare fișă rămânând salvată local pe dispozitiv), dar este **necesar**
pentru autentificare — fără backend configurat, aplicația pornește direct,
fără ecran de logare (potrivit doar dacă un singur telefon/calculator
folosește aplicația și nu contează cine anume completează).

1. Creează un Google Sheet nou, ex. „Fise PDI Tunland G7".
2. Extensii > Apps Script. Șterge codul exemplu, lipește tot conținutul
   fișierului `Code.gs`.
3. Din editor, rulează o dată funcția `setup` (meniul Run) — se creează
   automat foile „Fise", „Drafts" și „Utilizatori", plus folderul din Drive
   pentru PDF-uri. La prima rulare, Google va cere permisiuni — le accepți.
4. Deploy > New deployment > tip **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone with the link** (sau „Anyone" dacă vrei
     să meargă și pe telefoane fără cont Google logat)
5. Copiază URL-ul generat (se termină în `/exec`).
6. Deschide `data.js` din aplicație, la linia:
   ```js
   APPS_SCRIPT_URL: "",
   ```
   pune URL-ul copiat între ghilimele, apoi re-încarcă pagina pe
   GitHub (commit + push).

De acum, la „Finalizează", fiecare fișă:
- primește un număr automat (`ICG-PDI-0001`, `0002`, ...) calculat din Sheet;
- salvează un rând cu toate datele în Sheet;
- urcă PDF-ul (denumit `NrDocument_SerieSasiu_NumeClient.pdf`) și pozele
  vehiculului (dacă au fost făcute) în **același subfolder dedicat acelei
  livrări** — vezi secțiunea „Poze vehicul și organizarea în Drive" mai jos.

Dacă tehnicianul e offline în atelier, fișa se salvează local și se
sincronizează automat cu Drive/Sheet imediat ce revine semnalul.

## Poze vehicul și organizarea în Drive

Ultima secțiune a fișei (8 — „Poze vehicul", înainte de finalizare) cere un
set de 9 poze ale vehiculului, făcute direct din aplicație:

1. Față, 45° stânga
2. Față, 45° dreapta
3. Spate, 45° stânga
4. Spate, 45° dreapta
5. Interior față
6. Interior spate
7. Bord (instrumentar și kilometraj)
8. Compartiment motor
9. Serie șasiu (VIN)

Apăsând pe fiecare buton „Fotografiază" se deschide **direct camera foto a
telefonului** (nu galeria) — fiecare buton e etichetat cu poza cerută, ca
operatorul să știe exact ce unghi trebuie să facă. Poza e comprimată automat
pe dispozitiv (redimensionată, calitate JPEG redusă) înainte de a fi ținută
în memorie, ca să nu umple rapid spațiul de stocare local cu poze de 4-12 MB
direct de la cameră. Fiecare poză se poate reface oricând, apăsând din nou
pe același buton („Refă poza").

**Organizarea în Drive**: toate livrările ajung într-un singur folder
rădăcină, numit **„Livrări Inter Cargo Foton"**. În interiorul lui, fiecare
livrare (serie de șasiu) primește automat propriul subfolder, denumit:

```
<VIN> — <Marcă Model> — <Data livrării>
```

de exemplu:

```
LFOTUNLAND2026000123 — FOTON Tunland G7 — 2026-09-20
```

În acel subfolder ajung, la finalizare, atât PDF-ul fișei cât și toate
pozele făcute (fiecare poză, un fișier `.jpg` separat, denumit după tipul
ei — ex. `fata45Stanga.jpg`). Dacă se completează o a doua fișă pentru
aceeași serie de șasiu (aceleași VIN + model + dată), fișierele ajung în
același subfolder existent, nu se creează unul nou.

**Important de reținut**:
- Pozele **nu se inserează în PDF** — rămân fișiere separate, alături de
  PDF, în subfolderul dedicat livrării.
- Pozele **nu sunt obligatorii** pentru a finaliza fișa — dacă lipsește
  vreuna, fișa se poate finaliza oricum (pastila de progres arată, ex.,
  „7/9", doar informativ).
- Pozele **nu circulă prin mecanismul de predare a fișei între dispozitive**
  (draft birou ↔ atelier) — o celulă din Google Sheet are o limită de circa
  50.000 de caractere, prea puțin pentru poze în format text (base64). Ele
  se urcă în Drive **doar la finalizare**, direct de pe dispozitivul pe
  care au fost făcute. Dacă fișa e predată altui dispozitiv înainte de
  finalizare, pozele trebuie făcute de pe dispozitivul care finalizează.
- Setul de poze cerute e editabil în `data.js`, la lista `FOTO_TIPURI`
  (poți adăuga, șterge sau redenumi tipuri de poze fără să atingi restul
  codului).

## Autentificare și administrare conturi

Cu backend-ul configurat, oricine deschide aplicația trebuie să se
autentifice cu **nume + cod PIN**, dintr-o listă de conturi ținută în foaia
„Utilizatori" din Google Sheet. Contul e re-verificat pe server la fiecare
pornire a aplicației — dacă a fost dezactivat sau șters între timp, telefonul
respectiv pierde accesul imediat, chiar dacă avea sesiunea salvată local.

**Cont implicit** (creat automat de `setup()`): nume `admin`, PIN `0000`,
rol Administrator. **Schimbă acest PIN cât mai repede** — creează-ți propriul
cont de administrator din tab-ul „Utilizatori", apoi dezactivează sau
schimbă PIN-ul contului `admin` implicit (editează direct rândul din foaia
„Utilizatori" din Sheet, coloana „Cod PIN").

Doar rolul **Administrator** vede tab-ul „Utilizatori" din aplicație, de
unde poate:
- **adăuga** un cont nou (nume, rol — Vânzări / Service / Administrator —
  și un cod PIN pe care i-l comunici persoanei);
- **dezactiva/reactiva** un cont (acces blocat temporar, fără să pierzi
  istoricul contului);
- **șterge definitiv** un cont — exact situația unui angajat care pleacă
  din companie: după ștergere, persoana respectivă nu se mai poate
  autentifica pe niciun dispozitiv, indiferent dacă avea sesiunea salvată.
  Un administrator nu își poate șterge propriul cont (ca să nu rămână
  aplicația fără niciun administrator).

Rolul contului (Vânzări/Service/Administrator) controlează **doar** accesul
la ecranul „Utilizatori" — nu limitează ce completează cineva în fișă
(listele de la semnături, „Predat de (ICG)" / „Inspecție PDI", rămân
`VANZATORI` / `PERSONAL_SERVICE` din `data.js`, indiferent cine e logat).

## Căutare centrală (Arhiva Drive)

Pe lângă arhiva locală (fișele de pe acel dispozitiv), tab-ul „Arhivă" are
și o secțiune „Arhiva centrală" care caută în **toate** fișele finalizate,
indiferent pe ce dispozitiv au fost făcute — după VIN, nume client, număr
de document sau număr de înmatriculare. Necesită backend-ul Apps Script
configurat și conexiune la internet; rezultatele includ un link direct spre
PDF-ul din Drive.

## Structura fișei (capitole)

1. Date vehicul (marcă și model din liste derulante separate, plus buton **Tip motorizare**: Termic (ICE) / Electric — vezi secțiunea dedicată mai jos)
2. Date client
3. **Documente** — se pregătesc de obicei de o persoană de la birou (manual, garanție, carnet service, CoC, C.I.V., factură)
4. **Inventar accesorii** — diferă după tipul de motorizare (la termic: roată rezervă; la electric: cabluri de încărcare + kit reparație pană), plus elemente comune (pachet legislativ, trusă scule, covorașe, prelată, bare transversale, covor bena, extinctor, chei/cartele)
5. **Inspecție tehnică PDI** — se completează de personalul din service, la mașină; diferă după tipul de motorizare (la electric: grup dedicat bateriei/propulsiei electrice, în loc de fluide motor)
6. Observații generale
7. Confirmare predare-primire (semnături)
8. **Poze vehicul** — 9 poze obligatorii din punct de vedere al fluxului (dar neblocante la finalizare), făcute din cameră direct din aplicație — vezi secțiunea dedicată mai jos

## Flux de verificare vânzător ↔ service (Pass / Fail / Necesită intervenție)

Fișa are DOUĂ verificări de etapă, la nivel de secțiune (nu pe fiecare bifă
individuală), care controlează dacă fișa poate fi finalizată:

- **Verificare predare (vânzător)** — apare la finalul secțiunii 3
  (Documente), acoperă datele completate la deschidere + documentele.
  Vânzătorul apasă **Pass** (totul e în regulă) sau **Fail** (lipsește/e
  greșit un document sau o dată) — la Fail, motivul e **obligatoriu**.
- **Verificare service** — apare la finalul secțiunii 5 (Inspecție PDI),
  acoperă secțiunile 4 (Inventar accesorii) + 5 (PDI) împreună. Tehnicianul
  apasă **Pass** sau **Necesită intervenție service** — la fel, cu motiv
  obligatoriu.

**Cine completează ce**: în principiu vânzătorul verifică documentele și
deschide fișa, iar cel din service verifică starea mașinii și accesoriile —
dar tehnic, oricine logat poate completa orice câmp din fișă (rolul din
cont nu blochează formularul, doar accesul la tab-ul „Utilizatori”). Fiecare
buton de verificare reține automat **cine** l-a apăsat (numele + rolul
contului logat) și **când** — astfel se ține evidența cine are o operațiune
restantă de rezolvat.

**Trimiterea automată către service**: indiferent de rezultat (Pass sau
Fail), imediat ce vânzătorul confirmă verificarea lui, fișa e marcată automat
ca „partajată” și trimisă către server (dacă backend-ul e configurat) —
nu mai e nevoie să apeși separat „Trimite fișa mai departe”. Colegul din
service o preia cu numărul fișei, din tab-ul **Arhivă** → „Preia fișă de pe
alt dispozitiv”, sau direct din tab-ul **Fișe în așteptare** (mai jos).

**Rezolvare și revenire la Pass**: dacă o verificare a fost respinsă (Fail /
Necesită intervenție) și problema se rezolvă ulterior (documentul e adus,
accesoriul e completat, defecțiunea e reparată), oricine poate reveni la
acea secțiune și apăsa din nou **Pass** — motivul inițial rămâne vizibil ca
istoric, iar aplicația reține automat cine și când a rezolvat.

**Regula de finalizare**: butonul „Finalizează și generează PDF” verifică
înainte de orice că AMBELE verificări (vânzător + service) sunt pe **Pass**.
Dacă nu sunt, afișează motivele exacte și blochează finalizarea — **cu o
excepție**: un cont cu rolul **admin** poate forța închiderea fișei chiar cu
verificări nerezolvate (cu o confirmare explicită înainte), pentru cazurile
în care problema a fost rezolvată verbal/altfel și nu mai are sens să
blocheze fișa.

**Tab-ul „Fișe în așteptare”** — vizibil pentru oricine, arată toate fișele
trimise mai departe (de pe orice dispozitiv) care nu au încă ambele
verificări pe Pass, cu roșu pentru cele respinse/cu intervenție necesară,
motivul și numele persoanei responsabile. Necesită backend-ul Apps Script
configurat (secțiunea „Pasul 3” de mai sus) — fără el, tab-ul arată un mesaj
explicativ. O fișă dispare automat din listă imediat ce e finalizată.

## Editare conținut (texte, liste de verificare, nume personal)

Toate textele fișei (lista de accesorii, cele 32 de verificări PDI pe
categorii, pașii de combustibil etc.) sunt în `data.js`, într-un format
simplu de citit — poți adăuga/edita/șterge puncte fără să atingi restul
codului.

**Listele de nume** (tot în `data.js`):
```js
const VANZATORI = [
  "Popescu Andrei",
  "Ionescu Maria",
];

const PERSONAL_SERVICE = [
  "Georgescu Mihai",
  "Stan Radu",
];
```
- **„Predat de (ICG)"** se alege dintr-o listă derulantă populată din `VANZATORI`.
- **„Inspecție PDI"** se alege dintr-o listă derulantă populată din `PERSONAL_SERVICE`.
- **„Primit de (client)"** rămâne câmp text liber (numele clientului variază la fiecare fișă).

**Marcă și model** (tot în `data.js`) — la secțiunea 1 (Date vehicul), operatorul
alege din două liste derulante separate, nu mai scrie de mână:
```js
const MARCI = ["FOTON", "CAVAN"];

const MODELE_PE_MARCA = {
  "FOTON": [
    { nume: "Tunland G7", tip: TIP_MOTORIZARE.ICE },
    { nume: "Tunland V9", tip: TIP_MOTORIZARE.ICE },
    { nume: "eAumark", tip: TIP_MOTORIZARE.ELECTRIC },
    { nume: "eToano", tip: TIP_MOTORIZARE.ELECTRIC, variante: ["L2H2", "L2H3"] },
    { nume: "eMillerAuman", tip: TIP_MOTORIZARE.ELECTRIC },
    { nume: "eAuman", tip: TIP_MOTORIZARE.ELECTRIC },
    { nume: "Galaxus", tip: TIP_MOTORIZARE.ICE },
  ],
  "CAVAN": [
    { nume: "C1", tip: TIP_MOTORIZARE.ELECTRIC },
    { nume: "C1 Plus", tip: TIP_MOTORIZARE.ELECTRIC },
    { nume: "C1 Max", tip: TIP_MOTORIZARE.ELECTRIC },
  ],
};
```
**Cavan e o marcă separată** (nu un model FOTON) — deși ICG o vinde alături de
gama FOTON, are propria linie în `MARCI`/`MODELE_PE_MARCA`.

Lista de modele se filtrează automat după marca aleasă. Fiecare model are și
un `tip` (`TIP_MOTORIZARE.ICE` sau `TIP_MOTORIZARE.ELECTRIC`) — vezi secțiunea
următoare — și, opțional, o listă `variante` (ex. `eToano` are caroseriile
L2H2/L2H3): dacă un model are `variante`, câmpul „Versiune / motorizare” din
secțiunea 1 devine listă derulantă cu acele variante, în loc de text liber.
Dacă adaugi o marcă nouă în `MARCI`, adaugă și o listă de modele pentru ea în
`MODELE_PE_MARCA` (cu exact același text ca marca), altfel lista de modele
apare goală pentru acea marcă.

## Vehicule electrice (EV) vs. termice (ICE)

Fișa se adaptează automat după tipul de motorizare al vehiculului — un
FOTON Tunland (motor termic) și un FOTON eAumark (electric) au inventare de
accesorii și liste de inspecție PDI diferite, pentru că nu au sens aceleași
verificări (un vehicul electric nu are ulei de motor sau AdBlue, dar are
baterie de tracțiune, cablu de încărcare, frânare regenerativă etc.).

**Cum se alege tipul**: în secțiunea 1 (Date vehicul) există un buton
„Tip motorizare" cu două opțiuni, **Termic (ICE)** / **Electric**.
- Alegerea unui **model** din listă pre-completează automat tipul corect
  (modelele electrice — eToano, eAumark, Cavan — sunt deja marcate ca atare
  în `data.js`, vezi mai sus).
- Operatorul poate oricând schimba manual butonul, de exemplu pentru un
  model nou, neadăugat încă în `MODELE_PE_MARCA` cu tipul corect.
- **Model cu ambele variante**: dacă gama se extinde și un model ajunge să
  existe și termic și electric sub același nume, marchează-l în `data.js` cu
  `tip: TIP_MOTORIZARE.AMBELE` (exemplu în comentariul de lângă
  `MODELE_PE_MARCA`) — la alegerea lui, aplicația NU mai presupune un tip
  automat (afișează și „(termic sau electric)” lângă numele modelului în
  listă), operatorul alege manual din butonul de mai sus.
- Schimbarea tipului (automat sau manual) actualizează imediat secțiunile
  4 (Inventar accesorii) și 5 (Inspecție tehnică PDI), plus selectorul de
  nivel combustibil/baterie din secțiunea 1.

**Adăugarea de modele noi** — pe măsură ce gama FOTON se extinde, adaugi pur
și simplu o linie nouă în `MODELE_PE_MARCA` (vezi secțiunea de mai sus), cu
numele modelului și tipul lui; restul aplicației (formular, PDF, progres) se
adaptează automat, fără alte modificări de cod.

**Ce diferă concret**:
- **Nivel combustibil → Nivel baterie**: la un vehicul electric, secțiunea 1
  arată un selector de procent (10%–100%) în loc de treptele de combustibil
  (1/8...Plin).
- **Inventar accesorii** (`ACCESORII_COMUNE` + `ACCESORII_ELECTRIC_SUPLIMENTAR`
  în `data.js`): **roata de rezervă** și **kitul de reparat pană** apar acum
  ca bife SEPARATE, la ambele tipuri de motorizare — unele modele electrice
  au totuși roată de rezervă, iar unele termice vin doar cu kit de pană, deci
  operatorul bifează pe cea care se potrivește vehiculului din fața lui, nu
  una impusă automat de tipul de motorizare. În plus, doar la electric mai
  apar cablurile de încărcare (Mod 3 — stații publice/wallbox, și Mod 2 —
  priză casnică, dacă e livrat).
- **„Alte accesorii”** — o listă derulantă separată de bifele de mai sus
  (`ALTE_ACCESORII_OPTIUNI` în `data.js`), cu opțiunea implicită „Fără
  accesorii suplimentare”. Adaugă aici, oricând, alte accesorii speciale pe
  care le montați ocazional (ex. „Sistem de navigație suplimentar”) — apar
  automat în listă, fără alte modificări de cod.
- **Inspecție tehnică PDI** (`PDI_GROUPS_ICE` / `PDI_GROUPS_ELECTRIC` în
  `data.js`): la electric, grupul de fluide e înlocuit cu „Baterie și sistem
  de propulsie electrică" (nivel de încărcare la predare, sistem BMS fără
  erori, cabluri de înaltă tensiune intacte, trapă de încărcare, test de
  încărcare, frânare regenerativă, zgomote motor electric); bateria din
  grupul de sistem electric e redenumită „Baterie 12V auxiliară" (distinctă
  de bateria de tracțiune); verificarea finală înlocuiește kilometrajul
  primului service cu autonomia estimată afișată la bord. La ambele tipuri,
  grupul de sistem electric include acum și o verificare a **sistemului
  multimedia / infotainment** (ecran, radio, conectivitate).
- **PDF-ul** afișează câmpul „Tip motorizare" în secțiunea 1 și folosește
  aceleași liste de accesorii/PDI ca formularul, în funcție de tipul fișei.
- **Google Sheet**: rândul salvat la finalizare include acum și coloanele
  „Tip motorizare" și „Nivel baterie (%)", adăugate la finalul listei de
  coloane (nu în mijloc), ca să nu deplaseze coloanele unui Sheet deja creat
  cu `setup()` înainte de acest update. Dacă ai deja un Sheet în producție,
  adaugă manual cele două titluri de coloană la finalul rândului de antet
  (rândul 1), ca să apară etichetate corect.

Pentru a adăuga un nou tip de verificare specifică electricelor (sau a
elimina una), editează direct `PDI_GROUPS_ELECTRIC` / `ACCESORII_COMUNE` /
`ACCESORII_ELECTRIC_SUPLIMENTAR` din `data.js`, la fel cum ai edita orice
altă listă din fișă.

## Numerotare automată

Fiecare fișă primește un număr de înregistrare (`ICG-PDI-0001`, `0002`, ...)
**imediat ce este deschisă** — nu doar la finalizare — atât la pornirea unei
fișe noi cât și după ce finalizezi una (fișa următoare, goală, primește
deja numărul următor). Numerotarea pornește de la 1.

- Dacă backend-ul Apps Script e configurat și există semnal, numărul vine
  de la contorul central (atomic, sigur chiar dacă mai multe persoane
  deschid câte o fișă nouă în același timp).
- Dacă nu (offline sau backend neconfigurat), se folosește un contor local
  pe acel dispozitiv, ca să nu blocheze lucrul.

## Predarea fișei între dispozitive (birou ↔ atelier)

Dacă backend-ul Apps Script e configurat, o fișă poate fi începută pe un
dispozitiv (ex. biroul completează datele clientului) și continuată pe
altul (ex. tehnicianul din atelier completează PDI-ul și semnează):

1. Persoana care a început fișa apasă **„Trimite fișa mai departe"** —
   aplicația îi atribuie un număr (dacă nu are deja unul) și îl trimite
   pe server ca „draft".
2. Îi spune celeilalte persoane numărul (verbal, WhatsApp etc.).
3. A doua persoană, în tab-ul **Arhivă → „Preia fișă de pe alt dispozitiv"**,
   scrie numărul și apasă „Preia" — fișa se încarcă exact cum a lăsat-o
   prima persoană.
4. Modificările ulterioare se trimit automat pe server (autosave), atât
   timp cât fișa e marcată „partajată". Butonul „Preia ultima versiune"
   permite oricui să se sincronizeze manual dacă suspectează că cealaltă
   persoană a mai modificat ceva între timp.

Acest flux a fost testat automat (predare, editare pe al doilea
dispozitiv, sincronizare bidirecțională, finalizare, curățarea
draftului) — vezi `test/run-handoff-test.js`.

## Note tehnice

- Numerotarea documentelor: dacă backend-ul nu e configurat sau nu există
  semnal, se folosește un contor local pe dispozitiv; la reconectare,
  fișele nesincronizate se trimit automat.
- Semnăturile se desenează cu degetul/mouse-ul direct pe ecran și se
  salvează ca imagine în PDF.
- Arhiva locală ține toate fișele (draft + finalizate) în memoria
  browserului (`localStorage`) — nu se pierd la închiderea aplicației,
  dar sunt legate de dispozitiv/browser (de-asta contează sincronizarea
  cu Drive dacă vrei o copie centralizată).
- Autentificarea e gândită pentru un instrument intern (PIN + nume, fără
  furnizor extern de identitate) — suficientă ca să controlezi cine are
  acces și să revoci imediat accesul cuiva, nu pentru date puternic
  sensibile.

## Teste automate

Fiecare funcționalitate majoră are un test automat (Node.js + jsdom, care
simulează un browser complet, inclusiv un backend Apps Script fals în
memorie, fără să fie nevoie de o instalare reală pe GitHub/Google):

```
cd test
node run-test.js           # formular, numerotare, PDF, arhivă locală
node run-handoff-test.js   # predarea unei fișe între două dispozitive
node run-auth-test.js      # logare, roluri, adăugare/dezactivare/ștergere cont
```

Toate trei trebuie să afișeze „✅ TOATE TESTELE ... AU TRECUT" la final.
