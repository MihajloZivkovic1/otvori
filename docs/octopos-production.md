# Fiskalni računi preko Octopos-a — šta je potrebno za produkciju

Ovaj spisak šaljemo lokalu pre nego što uključimo fiskalizaciju. Dve varijante; lokal bira jednu.

## Varijanta A — Octopos izdaje fiskalne račune umesto vas (ESIR režim)

Nemate kasu u lokalu. Kad gost plati telefonom (ili kad konobar označi narudžbinu kao plaćenu kešom), otvori šalje
narudžbinu Octopos-u, Octopos je fiskalizuje kod Poreske uprave i vraća fiskalni račun. Gost dobija račun na
telefonu (PDF) i na mejl; vi ga imate u istoriji narudžbina.

**Potrebno od lokala**

- [ ] **Sertifikat Poreske uprave za vaš objekat.** Zahtev se podnosi na portalu Poreske uprave
      (ePorezi → eFiskalizacija → "Zahtev za bezbednosni element / sertifikat") za poslovni prostor u kome radite.
      Izaberite tip "virtuelni" (softverski) element — Octopos radi kao L-PFR/ESIR u oblaku, nema fizičkog čitača.
- [ ] **PDF sa pristupnim podacima** koji Poreska uprava pošalje posle odobrenja prosledite Octopos-u **bez
      otvaranja jednokratnih linkova iz njega** (linkovi za preuzimanje sertifikata važe jednom — ako ih kliknete,
      Octopos ne može da instalira sertifikat i mora se tražiti novi).
- [ ] **PIB, naziv i adresa objekta** onako kako stoje u rešenju o fiskalizaciji (štampaju se u zaglavlju svakog
      računa, a mi PIB upisujemo i u PDF).
- [ ] **Poreska stopa vaših artikala**: standardna Ђ (20 %) ili snižena Е (10 %). Trenutno se bira jedna stopa po
      lokalu; ako imate artikle sa obe stope, javite nam pre uključivanja.
- [ ] **Ugovor sa Octopos-om i cena po računu.** Octopos naplaćuje **svaki izdati fiskalni račun**. Svaka narudžbina
      plaćena telefonom i svaka koju konobar označi kao keš = jedan račun. Procenite mesečni broj računa pre potpisa.
- [ ] **Octopos token za vaš objekat** (dobijate od Octopos-a posle instalacije sertifikata) — upisujete ga vi ili mi u
      otvori → Podešavanja → Integracije → Octopos, zajedno sa produkcionom adresom API-ja. Token važi samo za vaš
      objekat i nikad se ne deli.
- [ ] **Mejl adresa za obaveštenja** (kome javljamo ako fiskalizacija ne uspe).

**Šta otvori radi automatski**

- izdaje račun na iznos narudžbine **bez napojnice** (napojnica nije promet), način plaćanja "Instant plaćanje" za
  IPS, "Gotovina" za keš;
- artikle koje Octopos ne poznaje kreira sa vašim nazivom, cenom, jedinicom KOM i izabranom poreskom stopom pri
  prvoj prodaji;
- ako Octopos ne odgovori, pokušava ponovo (30 s, 2 min, 10 min, 30 min, 2 h) i prikazuje konobaru "Fiskalni račun
  na čekanju" sa dugmetom za ponovni pokušaj; ako Octopos odbije zahtev (pogrešna stopa, pogrešan token), javlja
  odmah;
- čuva broj računa, link za proveru (suf.purs.gov.rs) i tekst računa; gost može da preuzme PDF i da ga pošalje na mejl.

**Šta otvori ne radi**

- storno i refundacije (rade se u Octopos back office-u, sa referencom na broj računa);
- dnevne/periodične izveštaje (Octopos / portal Poreske uprave);
- deljenje računa, avanse, fakture pravnim licima.

## Varijanta B — imate Octopos kasu u lokalu (POS režim)

Prihvaćene narudžbine se otvaraju na stolu u vašoj kasi; kad gost plati telefonom, otvori zatvara narudžbinu i
Octopos izdaje fiskalni račun. Keš naplaćujete na kasi kao i do sad.

**Potrebno od lokala**

- [ ] Octopos kasa sa uključenim API pristupom (traži se od Octopos-a) i **token za vaš objekat**.
- [ ] Nazivi stolova u kasi (otvori ih povlači sa kase i mapirate ih na svoje stolove u Podešavanjima).
- [ ] Šifre artikala: svaki artikal koji gost može da naruči mora da ima šifru iz kase (Podešavanja → Integracije →
      Sinhronizuj artikle to radi za vas); artikli bez šifre se ne mogu naručiti dok je uključeno slanje na kasu.
- [ ] Odgovor Octopos-a na dva pitanja koja još nisu potvrđena (mi ih postavljamo, vi ih podsetite):
      1. da li kasa štampa račune kreirane preko API-ja;
      2. da li postoji interni tip plaćanja za "Instant plaćanje" (bez njega otvori zatvara narudžbinu tako što je
         otkaže na stolu i izda račun ponovo — ispravan račun, ali konobar vidi da je sto "nestao" pa se pojavio račun).

**Mešovite narudžbine**: ako konobar na kasi dokuca još nešto na isti sto, gost ne može da plati telefonom samo svoj
deo — plaća ceo račun kod konobara. Pravilo za osoblje: "ili sve telefonom, ili sve kod konobara".

## Zajedničko

- Napojnice se ne fiskalizuju (idu na račun lokala preko banke, ali nisu na fiskalnom računu).
- Test okruženje: sve ovo se prvo probije na Octopos sandbox-u (tamo su test poreske stope, račun ide na
  sandbox.suf.purs.gov.rs). Na produkciju prelazimo tek kad vi potvrdite PIB, stope i cene.
- Kontakt: zdravo@otvori.menu.
