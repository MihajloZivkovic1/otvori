import { brand, links } from '../config';
import type { Dictionary } from './types';

export const sr: Dictionary = {
  htmlLang: 'sr-Latn',
  ogLocale: 'sr_RS',
  tagline: 'Skeniraj. Otvori. Naruči.',
  meta: {
    title: 'otvori — digitalni meni i naručivanje sa stola za kafiće, kafane i restorane',
    description:
      'Gost skenira kod sa stola, otvori meni i naruči. Cene menjaš sa telefona, narudžbine stižu konobaru. 30 dana besplatno, bez kartice.',
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
    h: 'Skeniraj kod. Otvori meni. Naruči.',
    sub: 'Gost skenira kod sa stola i za dve sekunde gleda tvoj meni. Cene menjaš sa telefona, a narudžbine stižu konobaru.',
    cta: 'Probaj 30 dana besplatno',
    demo: 'Pogledaj demo meni',
    note: 'Bez kartice. Otkazuješ kad hoćeš.',
  },
  guest: {
    tagline: 'Specialty kafa i doručak',
    table: 'Sto',
    hours: 'Kuhinja do 16:00',
    cat1: 'Kafa',
    cat2: 'Doručak',
    cat3: 'Peciva',
    items: 'stavke',
    cartItems: '2 stavke',
    send: 'Pošalji konobaru',
  },
  proof: 'Na stolovima u Beogradu, Novom Sadu i Nišu',
  how: {
    h: 'Tri koraka za gosta. Bez aplikacije.',
    steps: [
      {
        title: 'Skeniraj',
        text: 'Gost uperi kameru u kod na stolu. Bez instalacije, bez prijave, bez tvog Wi-Fi-ja.',
      },
      {
        title: 'Otvori',
        text: 'Meni se otvori u pretraživaču za dve sekunde, na srpskom ili engleskom, sa tvojim cenama od danas.',
      },
      {
        title: 'Naruči',
        text: 'Gost bira jela, doda napomenu i pošalje. Narudžbina stigne konobaru na telefon, sa brojem stola.',
        sub: 'Ili samo pogleda meni — naručivanje uključuješ kad hoćeš.',
      },
    ],
  },
  features: {
    h: 'Ono što ti treba u smeni. Ništa više.',
    order: {
      table: 'Sto 7',
      status: 'Nova',
      time: 'pre 1 min',
      lines: ['2 × Flat white', '1 × Tost sa avokadom'],
      note: '„Bez šećera, molim.”',
      accept: 'Prihvati',
      reject: 'Odbij',
    },
    call: { call: 'Pozovi konobara', bill: 'Račun', notified: 'Konobar je obavešten' },
    f1: {
      title: 'Narudžbine stižu konobaru na telefon',
      text: 'Gost bira iz menija i šalje. Konobar vidi sto, stavke i napomenu, prihvati jednim dodirom i nosi.',
    },
    f2: {
      title: 'Pozovi konobara i račun, jednim dodirom',
      text: 'Dva dugmeta na dnu menija. Konobar dobija obaveštenje sa brojem stola, gost vidi da je stiglo.',
    },
    rest: [
      { title: 'Promena cene za 10 sekundi', text: 'Promeniš broj, pritisneš Objavi. Gost odmah vidi novu cenu.' },
      {
        title: '„Nema danas” koje se samo vraća u 06:00',
        text: 'Nestalo jelo isključiš jednim potezom. Ujutru je opet na meniju, bez tebe.',
      },
      { title: 'Srpski i engleski sa jednog koda', text: 'Gost bira jezik. Isti kod, iste cene.' },
      { title: 'Alergeni i oznake (vegansko, ljuto, novo)', text: 'Po stavci, bez pitanja konobaru.' },
      { title: 'Tvoj logo i boje', text: 'Meni izgleda kao tvoj lokal, ne kao naš softver.' },
      { title: 'Ko šta gleda i naručuje, po stolu', text: 'Vidiš koji sto skenira, šta se naručuje i kad je gužva.' },
    ],
    payments: {
      title: 'Plaćanje telefonom, pravo na tvoj račun',
      text: 'Gost plati narudžbinu iz svoje bankarske aplikacije (IPS kod), novac leže direktno na račun lokala. Napojnica jednim dodirom, fiskalni račun na telefon.',
    },
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
      'Naručivanje i poziv konobara',
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
        q: 'Moram li da uključim naručivanje?',
        a: 'Ne. Biraš sam: samo meni, meni sa pozivom konobara, ili puno naručivanje. U gužvi ga pauziraš jednim prekidačem, a meni i dalje radi.',
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
        a: 'Otvoriš otvori.menu na telefonu, promeniš cenu, pritisneš Objavi. Kad nešto nestane, uključiš „Nema danas”. Jelo se samo vrati na meni u 06:00.',
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
    payments: {
      q: 'Kako radi plaćanje telefonom?',
      a: 'Gost skenira IPS kod ili uđe pravo u svoju bankarsku aplikaciju i potvrdi. Novac stiže na račun lokala preko tvog ugovora sa bankom, mi ne držimo ni dinar. Uključuje se po dogovoru, kad imaš e-commerce ugovor sa bankom.',
    },
  },
  cta: { h: 'Otvori meni na svakom stolu.' },
  footer: {
    desc: 'Digitalni meni i naručivanje sa stola za kafiće, kafane i restorane. Gost skenira, otvori i naruči.',
    contact: 'Kontakt',
    links: [
      { label: 'Cene', href: '#cene' },
      { label: 'Pitanja', href: '#pitanja' },
      { label: 'Prijava', href: links.signIn },
      { label: 'Uslovi', href: links.terms },
      { label: 'Privatnost', href: links.privacy },
    ],
    copyright: `© ${brand.foundingYear} ${brand.domain} · Beograd`,
  },
  card: {
    logo: 'TVOJ LOGO',
    note: 'Štampa na 300 g mat papiru, 90 × 90 mm, jednostrano. Link ispod koda ostaje za telefone bez čitača.',
  },
  langSwitch: { label: 'Jezik', sr: 'Srpski', en: 'English' },
};
