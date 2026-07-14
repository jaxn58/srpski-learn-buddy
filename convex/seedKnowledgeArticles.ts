/**
 * Seed Knowledge Articles (RAG v5)
 *
 * Initial cultural and practical articles for the AI Buddy knowledge base.
 * Run once via Convex Dashboard: npx convex run seedKnowledgeArticles:seedAll
 */
import { internalMutation } from "./_generated/server";

type ArticleSeed = {
  title: string;
  content: string;
  category: "culture" | "practical" | "language" | "cuisine" | "geography" | "immigration" | "history";
  language: string;
  tags: string[];
};

const SEED_ARTICLES: ArticleSeed[] = [
  // ============= CULTURE =============
  {
    title: "Serbian Slava — The Family Patron Saint Day",
    content: `Slava (Слава) is a uniquely Serbian tradition — the celebration of a family's patron saint. It is recognized by UNESCO as an intangible cultural heritage.

**How it works:**
- Each family has one patron saint, inherited through the father's line.
- The celebration includes a special ritual bread (slavski kolač), wheat dish (koljivo/žito), red wine, and a candle.
- A priest blesses the bread and wine, often visiting the home.
- The host family prepares a feast for guests — neighbors, friends, family.

**Most common Slavas:**
- Sveti Nikola (St. Nicholas) — December 19
- Sveti Sava (St. Sava) — January 27
- Sveti Jovan (St. John) — January 20
- Đurđevdan (St. George) — May 6
- Aranđelovdan (St. Archangel Michael) — November 21
- Mitrovdan (St. Demetrius) — November 8

**Etiquette for guests:**
- Always bring a gift (wine, flowers, or sweets)
- Say "Srećna Slava!" (Happy Slava!) when greeting
- It's polite to eat well — refusing food can offend the host
- You may receive a small piece of slavski kolač to take home

**Cultural significance:**
Slava embodies Serbian identity: hospitality, faith, family continuity, and community. Even non-religious Serbs often celebrate Slava as a cultural tradition.`,
    category: "culture",
    language: "en",
    tags: ["slava", "tradition", "patron saint", "holiday"],
  },
  {
    title: "Kafana Culture — The Serbian Coffee House Tradition",
    content: `The kafana (кафана) is the soul of Serbian social life. Far more than a café, it's where friendships are forged, business is discussed, and music fills the air.

**What makes a kafana special:**
- Traditional kafanas serve Turkish coffee (turska kafa), rakija, and hearty Serbian food
- Live music (tamburica or folk bands) is common, especially on weekends
- It's perfectly normal to spend hours in a kafana — there's no rush
- Kafanas range from rustic village spots to elegant Belgrade establishments

**Famous kafanas in Belgrade:**
- Znak Pitanja (?) — the oldest kafana in Belgrade (since 1823)
- Tri Šešira — in the bohemian quarter Skadarlija
- Dva Jelena — also in Skadarlija, known for live music

**Coffee culture:**
- "Ajde na kafu" (Let's go for a coffee) is the universal Serbian invitation — it means "let's hang out"
- Turska kafa is made in a džezva (small pot) and served in a fildžan (small cup)
- Coffee is always served with a glass of water
- Domaća kafa = homemade/Turkish coffee

**Unwritten rules:**
- The person who invites usually pays
- Don't hurry — sitting and talking is the point
- If someone offers you rakija, refusing is almost offensive
- "Živeli!" (Cheers!) is the essential toast`,
    category: "culture",
    language: "en",
    tags: ["kafana", "coffee", "social life", "belgrade"],
  },
  {
    title: "Serbian Christmas (Božić) and Christmas Eve (Badnje Veče)",
    content: `Serbian Orthodox Christmas is celebrated on January 7th (following the Julian calendar). The celebrations begin on Badnje Veče (Christmas Eve, January 6th).

**Badnje Veče traditions:**
- Burning of the badnjak (young oak branch) — symbolizes the warmth of the hearth
- Fasting meal: posna jela (Lenten food) — no meat, dairy, or eggs
- Common dishes: riblja čorba (fish soup), stuffed peppers, prebranac (baked beans)
- The family gathers, and the atmosphere is warm and reverent

**Christmas Day (Božić):**
- česnica — special round bread with a coin baked inside; whoever finds the coin will have good luck all year
- The first visitor (položajnik) is important — they should bring good fortune
- Traditional greeting: "Hristos se rodi!" (Christ is born!) — Response: "Vaistinu se rodi!" (Indeed He is born!)
- Rich feast: roasted pork (pečenje), sarma, various salads

**Key vocabulary:**
- Božić = Christmas
- Badnje Veče = Christmas Eve
- česnica = Christmas bread
- badnjak = oak branch
- pečenje = roast
- Srećan Božić! = Merry Christmas!`,
    category: "culture",
    language: "en",
    tags: ["christmas", "bozic", "badnje vece", "holiday", "tradition"],
  },

  // ============= PRACTICAL =============
  {
    title: "Opening a Bank Account in Serbia",
    content: `If you're living or working in Serbia, you'll need a local bank account. Here's a practical guide.

**Requirements:**
- Valid passport or ID card
- Proof of address (rental contract or utility bill) — not always required
- Serbian tax number (PIB) — can usually be obtained at the bank
- For non-residents: some banks require a residence permit

**Major banks:**
- Banca Intesa — largest bank, wide ATM network
- UniCredit Bank — international, good for expats
- Raiffeisen Bank — reliable, digital-friendly
- OTP Banka — competitive fees
- Erste Bank — good online banking

**Typical fees:**
- Account maintenance: 200-500 RSD/month
- Debit card: usually free with account
- ATM withdrawals: free at own bank, 50-150 RSD at others
- International transfers: varies widely

**Tips:**
- Many banks offer accounts in EUR and RSD — ask for a multi-currency account
- Mobile banking apps are well-developed in Serbia
- "Tekući račun" = current account, "Devizni račun" = foreign currency account
- Say: "Želim da otvorim račun" (I want to open an account)

**Useful Serbian:**
- banka = bank
- račun = account
- uplata = deposit
- isplata = withdrawal
- prenos = transfer
- kurs = exchange rate`,
    category: "practical",
    language: "en",
    tags: ["bank", "account", "finance", "expat"],
  },
  {
    title: "Renting an Apartment in Serbia",
    content: `Finding and renting an apartment in Serbia — practical tips for newcomers.

**Where to search:**
- halooglasi.com — the biggest classified ads website
- nekretnine.rs — real estate portal
- 4zida.rs — modern apartment search
- Facebook groups: "Stanovi Beograd" etc.
- Real estate agencies (agencija za nekretnine)

**Typical process:**
1. Contact the landlord/agency
2. Visit the apartment (ask: "Mogu li da obiđem stan?" — Can I visit the apartment?)
3. Negotiate the price (this is expected!)
4. Sign a contract (ugovor o zakupu)
5. Pay the deposit (usually 1-2 months' rent, called "depozit" or "kapara")

**Average monthly rents (2024, Belgrade):**
- Studio (garsonjera): 250-400 EUR
- 1-bedroom (jednosoban): 350-550 EUR
- 2-bedroom (dvosoban): 450-700 EUR
- Outside Belgrade: 30-50% cheaper

**What to check:**
- Heating type: centralno grejanje (central) vs. klima (AC/heat) vs. gas
- Registration: you need to register your address at the police station (MUP)
- Bills: ask what's included — "Da li su računi uključeni?" (Are bills included?)
- Contract should state deposit amount, notice period, and inventory

**Useful vocabulary:**
- stan = apartment
- kirija = rent
- grejanje = heating
- namešten = furnished
- nenamešten = unfurnished
- sprat = floor
- lift = elevator`,
    category: "practical",
    language: "en",
    tags: ["apartment", "rent", "housing", "expat"],
  },
  {
    title: "Doctor's Visit in Serbia — Healthcare Basics",
    content: `Navigating the Serbian healthcare system as a foreigner.

**Public healthcare (RFZO):**
- Serbia has a public health insurance system (RFZO — Republički fond za zdravstveno osiguranje)
- If employed in Serbia, your employer pays into RFZO
- With RFZO, most visits and treatments are free or very low cost
- You need a "zdravstvena knjižica" (health card) and a "lekarski izveštaj" (doctor's referral)
- Waiting times can be long

**Private healthcare:**
- Many expats prefer private clinics for faster service
- Popular chains: Medigroup, Acibadem, Euromedik, Bel Medic
- A general consultation costs 3,000-5,000 RSD (~25-45 EUR)
- Specialist visits: 5,000-10,000 RSD

**At the pharmacy (apoteka):**
- Many medications available without prescription
- Common chains: Dr. Max, Lilly
- Pharmacists are knowledgeable and can recommend treatment for minor issues

**Emergency:**
- Emergency number: 194 (ambulance)
- General emergency: 112
- Urgent Center (Urgentni centar) — Belgrade's main ER

**Useful phrases:**
- "Ne osećam se dobro" — I don't feel well
- "Imam temperaturu" — I have a fever
- "Boli me..." — It hurts... (+ body part)
- "Glava" — head, "stomak" — stomach, "grlo" — throat
- "Treba mi lek za..." — I need medicine for...
- "Imam alergiju na..." — I'm allergic to...
- "Hitna pomoć" — emergency help`,
    category: "practical",
    language: "en",
    tags: ["doctor", "health", "hospital", "emergency"],
  },

  // ============= CUISINE =============
  {
    title: "Essential Serbian Food — A Guide for Newcomers",
    content: `Serbian cuisine is hearty, flavorful, and deeply tied to social gatherings. Here's what you need to know.

**Must-try dishes:**
- Ćevapi (ћевапи) — grilled minced meat sausages, served in lepinja (flatbread) with onions and kajmak
- Pljeskavica — Serbian hamburger, much larger and tastier than what you're used to
- Sarma — cabbage rolls stuffed with meat and rice
- Gibanica — layered filo pastry with cheese and eggs
- Burek — flaky pastry with meat (or cheese: "sa sirom", or spinach: "sa zeljem")
- Prebranac — baked beans, a classic comfort food
- Karađorđeva šnicla — rolled, stuffed, and breaded schnitzel
- Ajvar — roasted red pepper spread, the "Serbian gold"

**Soups and starters:**
- Čorba — thick soup (try: teleća čorba = veal soup)
- Supa — clear broth with noodles
- Srpska salata — tomato, onion, pepper salad
- Šopska salata — like srpska but with grated white cheese on top

**Drinks:**
- Rakija — fruit brandy, the national spirit (try: šljivovica = plum, kajsijevača = apricot)
- Turska kafa — Turkish coffee
- Sok od... — juice (sok od pomorandže = orange juice)
- Kisela voda — sparkling water
- Pivo — beer (Jelen, Lav, Zaječarsko)

**Dining etiquette:**
- "Prijatno!" — Bon appétit!
- "Živeli!" — Cheers!
- Portions are generous — don't order too much!
- Tipping: 10% is standard, round up for casual spots`,
    category: "cuisine",
    language: "en",
    tags: ["food", "restaurant", "dishes", "traditional"],
  },

  // ============= GEOGRAPHY =============
  {
    title: "Serbia's Key Cities and Regions",
    content: `Understanding Serbia's geography helps you navigate the country and its culture.

**Belgrade (Beograd):**
- Capital and largest city (~1.7 million)
- At the confluence of the Danube and Sava rivers
- Key areas: Stari Grad (Old Town), Novi Beograd (New Belgrade), Zemun, Dorćol, Vračar
- The Kalemegdan Fortress is the city's historic heart

**Novi Sad:**
- Second largest city, capital of Vojvodina province
- Home of the EXIT music festival
- Petrovaradin Fortress overlooks the Danube
- More relaxed pace than Belgrade, known as the "Serbian Athens"

**Niš:**
- Third largest city, in southern Serbia
- Birthplace of Emperor Constantine
- Known for: Niška Tvrđava (fortress), Skull Tower (Ćele Kula)
- Famous for its spicy cuisine and ćevapi

**Other notable cities:**
- Kragujevac — industrial city, site of WWII memorial
- Subotica — Art Nouveau architecture, near Hungarian border
- Zlatibor, Kopaonik, Tara — mountain resorts for skiing and hiking

**Regions:**
- Vojvodina (north) — flat plains, multi-ethnic, agricultural
- Šumadija (central) — rolling hills, traditional heartland
- Southern Serbia — mountainous, warmer climate
- Western Serbia — rivers, gorges, nature parks`,
    category: "geography",
    language: "en",
    tags: ["cities", "regions", "belgrade", "novi sad", "nis"],
  },

  // ============= IMMIGRATION =============
  {
    title: "Residence Permit Basics for Foreigners in Serbia",
    content: `Key information about living legally in Serbia as a foreigner.

**Visa-free entry:**
- EU/EEA citizens: 90 days without a visa
- US, Canada, Australia, UK: 90 days visa-free
- After 90 days, you need a residence permit (boravišna dozvola)

**Types of residence permits:**
- Temporary residence (privremeni boravak) — renewed annually
- Permanent residence (stalni boravak) — after 5 years of temporary residence
- Common grounds: work, study, family reunification, property ownership

**Application process:**
1. Apply at the local police station (MUP — Ministarstvo Unutrašnjih Poslova)
2. Required documents vary, but typically:
   - Valid passport
   - Proof of accommodation
   - Health insurance
   - Proof of income or employment
   - Criminal background check (from home country, apostilled)
3. Processing time: 30-60 days

**Important rules:**
- Register your address within 24 hours of arrival (hotels do this automatically)
- White Card (beli karton) — address registration receipt
- Always carry your passport or residence permit
- Work permit (radna dozvola) is separate from residence permit

**Useful vocabulary:**
- boravišna dozvola = residence permit
- radna dozvola = work permit
- pasoš = passport
- policija = police
- MUP = Interior Ministry
- stranac = foreigner
- prijava boravišta = address registration`,
    category: "immigration",
    language: "en",
    tags: ["visa", "residence", "permit", "expat", "legal"],
  },

  // ============= HISTORY =============
  {
    title: "Key Moments in Serbian History — Quick Overview",
    content: `Understanding Serbian history helps you connect with the culture and people.

**Medieval Serbia:**
- Nemanjić dynasty (12th-14th century) — Serbia's golden age
- Stefan Nemanja founded the dynasty; his son became Saint Sava
- Tsar Dušan (Stefan Dušan) expanded Serbia to its largest territory
- The Battle of Kosovo (1389) — epic defeat against the Ottomans, central to Serbian identity

**Ottoman period (15th-19th century):**
- Nearly 500 years of Ottoman rule
- Two Serbian Uprisings (1804, 1815) led to autonomy
- Full independence recognized in 1878

**20th century:**
- Balkan Wars (1912-1913) — Serbia expanded territory
- WWI — Serbia suffered enormous casualties (lost ~25% of population)
- Kingdom of Yugoslavia (1918-1941) — union of South Slavic peoples
- WWII — Nazi occupation, resistance movements (Partisans and Chetniks)
- Socialist Yugoslavia (1945-1991) under Tito
- Wars of Yugoslav succession (1991-1999)

**Modern Serbia:**
- Republic of Serbia as independent state since 2006 (Montenegro separation)
- EU candidate since 2012
- Belgrade is becoming a regional tech and startup hub

**Important cultural references:**
- Kosovo Polje = Field of Blackbirds (sacred historical site)
- Vidovdan (June 28) = St. Vitus Day, anniversary of Battle of Kosovo
- "Samo sloga Srbina spasava" = Only unity saves the Serbs (national motto)`,
    category: "history",
    language: "en",
    tags: ["history", "medieval", "ottoman", "modern"],
  },
];

// @ts-ignore TS2589
export const seedAll = internalMutation({
  args: {},
  // @ts-ignore TS2589
  handler: async (ctx) => {
    const existing = await ctx.db.query("knowledgeArticles").collect();

    let created = 0;
    let skipped = 0;

    for (const article of SEED_ARTICLES) {
      const alreadyExists = existing.some((e) => e.title === article.title);
      if (alreadyExists) {
        skipped++;
        continue;
      }

      await ctx.db.insert("knowledgeArticles", {
        title: article.title,
        content: article.content,
        category: article.category,
        language: article.language,
        tags: article.tags,
        status: "published",
        createdAt: Date.now(),
      });
      created++;
    }

    console.log(`[seed] Knowledge articles: ${created} created, ${skipped} skipped (already existed)`);
    return { created, skipped };
  },
});
