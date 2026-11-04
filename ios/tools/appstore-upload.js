#!/usr/bin/env node
// Enters the App Store texts from ios/AppStore.md in App Store Connect, for all four languages:
// name, subtitle and privacy policy URL (app info), and description, keywords, promotional
// text, support and marketing URLs (the version being prepared). Node 18+, no npm.
//
//   node ios/tools/appstore-upload.js --dry-run
//   node ios/tools/appstore-upload.js --key AuthKey_X.p8 --key-id X --issuer xxxx [--whats-new]
//
// "What's New" is left out by default: App Store Connect does not accept it for the first version.
const fs = require('fs');
const path = require('path');
const { arg, api, all, rel, appByBundle } = require('./asc.js');

const DRY = process.argv.includes('--dry-run');
const BUNDLE = arg('bundle') || 'software.rdd.topple';
const SITE = 'https://topple.rdd.software/';
const URLS = { privacyPolicyUrl: SITE + 'privatnost.html', supportUrl: SITE + 'kontakt.html', marketingUrl: SITE };
const LOCALES = [['Hrvatski', 'hr'], ['English', 'en-US'], ['Italiano', 'it'], ['Deutsch', 'de-DE']];
const LIMITS = { name: 30, subtitle: 30, promotionalText: 170, keywords: 100, description: 4000, whatsNew: 4000 };

// Each language section has the fields in this order: name, subtitle, promotional text,
// keywords, description, what's new (labels are in the section's language).
function readTexts() {
  const md = fs.readFileSync(path.join(__dirname, '..', 'AppStore.md'), 'utf8');
  const out = {};
  for (const sec of md.split('\n## ').slice(1)) {
    const lang = LOCALES.find(([title]) => sec.startsWith(title));
    if (!lang) continue;
    const fields = [];
    for (const line of sec.split('\n').slice(1)) {
      const m = /^\*\*[^*]+:\*\*\s*(.*)$/.exec(line);
      if (m) fields.push([m[1]]);
      else if (fields.length && line.trim() !== '---') fields[fields.length - 1].push(line);
    }
    const [name, subtitle, promotionalText, keywords, description, whatsNew] = fields.map(f => f.join('\n').trim());
    out[lang[1]] = { name, subtitle, promotionalText, keywords, description, whatsNew };
  }
  for (const [, loc] of LOCALES) {
    const t = out[loc];
    if (!t) throw new Error(`AppStore.md: nema jezika ${loc}`);
    for (const [k, max] of Object.entries(LIMITS)) {
      if (!t[k]) throw new Error(`AppStore.md (${loc}): prazno polje ${k}`);
      if ([...t[k]].length > max) throw new Error(`AppStore.md (${loc}): ${k} ima ${[...t[k]].length} znakova, najviše ${max}`);
      // App Store Connect rejects emoji and other pictographs in the texts.
      const emoji = t[k].match(/\p{Extended_Pictographic}/gu);
      if (emoji) throw new Error(`AppStore.md (${loc}): ${k} sadrži znakove koje App Store ne prima: ${[...new Set(emoji)].join(' ')}`);
    }
  }
  return out;
}

async function upsert(list, locale, type, relName, parentType, parentId, attrs) {
  const cur = list.find(x => x.attributes.locale === locale);
  if (cur) await api('PATCH', `/v1/${type}/${cur.id}`, { data: { type, id: cur.id, attributes: attrs } });
  else await api('POST', `/v1/${type}`, { data: { type, attributes: { locale, ...attrs }, relationships: { [relName]: rel(parentType, parentId) } } });
  return cur ? 'promijenjeno' : 'dodano';
}

(async () => {
  const texts = readTexts();
  for (const [, loc] of LOCALES) {
    const t = texts[loc];
    console.log(`${loc.padEnd(6)} ${t.name} | ${t.subtitle} | opis ${[...t.description].length} znakova, ključne riječi ${[...t.keywords].length}`);
  }
  if (DRY) return;

  const app = await appByBundle(BUNDLE);
  // App info (name, subtitle, privacy policy): the one that can still be edited.
  const infos = await all(`/v1/apps/${app.id}/appInfos`);
  const editable = s => !['READY_FOR_DISTRIBUTION', 'READY_FOR_SALE', 'REPLACED_WITH_NEW_INFO'].includes(s);
  const info = infos.find(i => editable(i.attributes.state || i.attributes.appStoreState)) || infos[0];
  const infoLocs = await all(`/v1/appInfos/${info.id}/appInfoLocalizations`);
  // The version being prepared (description, keywords, promotional text, URLs).
  const versions = await all(`/v1/apps/${app.id}/appStoreVersions?filter[platform]=IOS&limit=20`);
  const version = versions.find(v => ['PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED', 'METADATA_REJECTED'].includes(v.attributes.appStoreState || v.attributes.appVersionState));
  if (!version) throw new Error('Nema verzije u pripremi (Prepare for Submission).');
  const verLocs = await all(`/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations`);
  console.log(`\nAplikacija ${BUNDLE}, verzija ${version.attributes.versionString}`);

  for (const [, loc] of LOCALES) {
    const t = texts[loc];
    const a = await upsert(infoLocs, loc, 'appInfoLocalizations', 'appInfo', 'appInfos', info.id,
      { name: t.name, subtitle: t.subtitle, privacyPolicyUrl: URLS.privacyPolicyUrl });
    const attrs = { description: t.description, keywords: t.keywords, promotionalText: t.promotionalText, supportUrl: URLS.supportUrl, marketingUrl: URLS.marketingUrl };
    if (process.argv.includes('--whats-new')) attrs.whatsNew = t.whatsNew;
    const b = await upsert(verLocs, loc, 'appStoreVersionLocalizations', 'appStoreVersion', 'appStoreVersions', version.id, attrs);
    console.log(`  ${loc.padEnd(6)} naziv i podnaslov: ${a}; opis i ključne riječi: ${b}`);
  }
  console.log('\nGotovo. Provjeri tekstove u App Store Connectu (kartica Distribution, svaki jezik gore desno).');
})().catch(e => { console.error('GREŠKA: ' + e.message); process.exit(1); });
