import { brand, links } from '../config';
import type { Dictionary } from './types';

export const sr: Dictionary = {
  htmlLang: 'sr-Latn',
  ogLocale: 'sr_RS',
  meta: {
    title: 'salveta — digitalni meni za kafiće, kafane i restorane',
    description:
      'Gost skenira QR kod sa stola i za dve sekunde gleda tvoj meni. Cene menjaš sa telefona, bez štampe. 30 dana besplatno, bez kartice.',
  },
  nav: {
    how: 'Kako radi',
    features: 'Šta dobijaš',
    pricing: 'Cene',
    faq: 'Pitanja',
    signIn: 'Prijava',
    tryFree: 'Probaj besplatno',
    menu: 'Meni',
    close: 'Zatvori',
  },
  hero: {
    h: 'Sve što je dobro, piše na salveti.',
    sub: 'Gost skenira kod sa stola i za dve sekunde gleda tvoj meni. Cene menjaš sa telefona, bez štampe.',
    cta: 'Probaj 30 dana besplatno',
    demo: 'Pogledaj demo meni',
    note: 'Bez kartice. Otkazuješ kad hoćeš.',
    napkinCaption: 'skeniraj za meni',
  },
  guest: {
    tagline: 'Specialty kafa i doručak',
    table: 'Sto',
    hours: 'Kuhinja do 16:00',
    cat1: 'Kafa',
    cat2: 'Doručak',
    cat3: 'Peciva',
    items: 'stavke',
  },
  proof: 'Na stolovima u Beogradu, Novom Sadu i Nišu',
  how: {
    h: 'Tri koraka. Gotovo za jedno popodne.',
    steps: [
      {
        title: 'Uneseš meni (ili ga mi unesemo za tebe)',
        text: 'Kategorije, jela, cene. Pošalji nam stari meni i mi uradimo ostalo.',
      },
      { title: 'Zalepiš kod na sto', text: 'Odštampaš sam ili ti donesemo gotove kartice.' },
      { title: 'Gost skenira i čita', text: 'Bez aplikacije. Otvara se u pretraživaču, za dve sekunde.' },
    ],
  },
  features: {
    h: 'Ono što ti treba u smeni. Ništa više.',
    editor: { item: 'Stavka', price: 'Cena', available: 'Dostupno', publish: 'Objavi' },
    unavailable: { title: 'Nema danas', done: 'Gotovo', back: 'Sve se vraća u 06:00.', until: 'do 06:00' },
    f1: { title: 'Promena cene za 10 sekundi', text: 'Promeniš broj, pritisneš Objavi. Gost odmah vidi novu cenu.' },
    f2: {
      title: '„Nema danas” prekidač koji se sam vraća u 06:00',
      text: 'Nestalo jelo isključiš jednim potezom. Ujutru je opet na meniju, bez tebe.',
    },
    rest: [
      { title: 'Srpski i engleski sa jednog koda', text: 'Gost bira jezik. Isti kod, iste cene.' },
      { title: 'Alergeni i oznake (vegansko, ljuto, novo)', text: 'Po stavci, bez pitanja konobaru.' },
      { title: 'Tvoj logo i boje', text: 'Meni izgleda kao tvoj lokal, ne kao naš softver.' },
      { title: 'Ko šta gleda, po stolu', text: 'Vidiš koji sto skenira i kad je gužva.' },
    ],
  },
  setup: {
    eyebrow: 'Unos menija i QR kartice',
    h: 'Nemaš vremena? Dođemo mi.',
    p: 'Dođemo u lokal. Unesemo ceo meni sa slikama i prevodom i ostavimo odštampane QR stalke i kartice na svakom stolu. Ti samo potvrdiš cene.',
    cta: 'Zatraži ponudu',
    price: 'Jednokratno, od 6.000 RSD. Zavisi od broja stolova.',
    list: [
      'Unos celog menija sa fotografijama',
      'Prevod na engleski',
      'QR kartica i stalak za svaki sto, odštampano i dostavljeno',
      'Obuka od 15 minuta za smenu',
    ],
    logo: 'LOGO',
  },
  pricing: {
    h: 'Jedna cena mesečno. Bez sitnih slova.',
    monthly: 'Mesečno',
    yearly: 'Godišnje',
    twoFree: '2 meseca gratis',
    perMonth: 'RSD / mesec',
    perYear: 'RSD / godina',
    popular: 'Najčešći izbor',
    starterFor: 'Jedan lokal',
    proFor: 'Više lokala ili više jezika',
    starterList: [
      'Jedan lokal',
      'Meni bez ograničenja stavki',
      'QR kodovi za sve stolove',
      'Srpski + engleski',
      'Osnovna statistika',
    ],
    proList: [
      'Više lokala pod jednim nalogom',
      'Više jezika',
      'Brending: tvoj logo i boje',
      'Napredna statistika po stolu i satu',
      'Prioritetna podrška',
    ],
    trialNote: '30 dana besplatno, bez kartice.',
    setupLine: 'Unos menija i QR kartice za stolove: od 6.000 RSD jednokratno, zavisi od broja stolova.',
    toggleLabel: 'Period naplate',
  },
  faq: {
    h: 'Pitanja koja nam svi postave',
    sub: 'Nešto drugo? Piši na',
    items: [
      {
        q: 'Da li gost mora da instalira aplikaciju?',
        a: 'Ne. Uperi kameru u kod i meni se otvori u pretraživaču. Bez preuzimanja, bez registracije.',
      },
      {
        q: 'Šta ako je slab internet u lokalu?',
        a: 'Gost koristi svoj mobilni internet, ne tvoj Wi-Fi. Meni je lagan i otvara se i na slabom signalu. Za svaki slučaj, drži par štampanih menija.',
      },
      {
        q: 'Mogu li da imam više lokala?',
        a: 'Da, na Pro paketu. Svi lokali su pod jednim nalogom, svaki sa svojim menijem, kodovima i statistikom.',
      },
      {
        q: 'Kako menjam cene i šta kad nešto nestane?',
        a: 'Otvoriš salvetu na telefonu, promeniš cenu, pritisneš Objavi. Kad nešto nestane, uključiš „Nema danas”. Jelo se samo vrati na meni u 06:00.',
      },
      {
        q: 'Radi li na starijim telefonima?',
        a: 'Da. Dovoljan je telefon sa kamerom i pretraživačem, što je sve od 2017. naovamo. Ispod koda stoji i kratak link za one bez čitača.',
      },
      {
        q: 'Kako otkazujem?',
        a: 'Jednim klikom u podešavanjima. Bez poziva i bez otkaznog roka. Meni radi do kraja plaćenog perioda.',
      },
    ],
  },
  cta: { h: 'Stavi salvetu na sto.' },
  footer: {
    desc: 'Digitalni meni za kafiće, kafane i restorane. Gost skenira, ti menjaš cene sa telefona.',
    contact: 'Kontakt',
    links: [
      { label: 'Cene', href: '#cene' },
      { label: 'Pitanja', href: '#pitanja' },
      { label: 'Prijava', href: links.signIn },
      { label: 'Uslovi', href: links.terms },
      { label: 'Privatnost', href: links.privacy },
    ],
    copyright: `© ${brand.foundingYear} salveta.menu · Beograd`,
  },
  og: { sub: 'Digitalni meni za kafiće i kafane. Gost skenira, ti menjaš cene sa telefona.' },
  card: {
    logo: 'TVOJ LOGO',
    note: 'Štampa na 300 g mat papiru, jednostrano. Isečena ivica u donjem desnom uglu je deo oblika salvete. Link ispod koda ostaje za telefone bez čitača.',
    tagline: 'Sve što je dobro, piše na salveti.',
  },
  langSwitch: { label: 'Jezik', sr: 'Srpski', en: 'English' },
};
