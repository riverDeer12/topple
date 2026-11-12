#!/usr/bin/env node
// Enters the App Store texts from ios/AppStore.md in App Store Connect, for all four languages:
// name, subtitle and privacy policy URL (app info), and description, keywords, promotional
// text, support and marketing URLs (the version being prepared). Node 18+, no npm.
//
//   node ios/tools/appstore-upload.js --dry-run
//   node ios/tools/appstore-upload.js --key AuthKey_X.p8 --key-id X --issuer xxxx [--whats-new]
//     [--version 1.1] [--build 103]
//
// "What's New" is left out by default: App Store Connect does not accept it for the first version.
// --version: create that version if none is being prepared (or rename the one being prepared).
// --build: wait until that build number has been processed and select it for the version.
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
  // The version being prepared (description, keywords, promotional text, URLs).
  const versions = await all(`/v1/apps/${app.id}/appStoreVersions?filter[platform]=IOS&limit=20`);
  let version = versions.find(v => ['PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED', 'METADATA_REJECTED'].includes(v.attributes.appStoreState || v.attributes.appVersionState));
  const want = arg('version');
  if (!version && want) {
    version = (await api('POST', '/v1/appStoreVersions', { data: { type: 'appStoreVersions', attributes: { platform: 'IOS', versionString: want }, relationships: { app: rel('apps', app.id) } } })).data;
    console.log(`Napravljena verzija ${want}.`);
  } else if (version && want && version.attributes.versionString !== want) {
    await api('PATCH', `/v1/appStoreVersions/${version.id}`, { data: { type: 'appStoreVersions', id: version.id, attributes: { versionString: want } } });
    version.attributes.versionString = want;
  }
  if (!version) throw new Error('Nema verzije u pripremi (Prepare for Submission); dodaj --version.');
  // App info (name, subtitle, privacy policy): the one that can still be edited.
  const infos = await all(`/v1/apps/${app.id}/appInfos`);
  const editable = s => !['READY_FOR_DISTRIBUTION', 'READY_FOR_SALE', 'REPLACED_WITH_NEW_INFO'].includes(s);
  const info = infos.find(i => editable(i.attributes.state || i.attributes.appStoreState)) || infos[0];
  const infoLocs = await all(`/v1/appInfos/${info.id}/appInfoLocalizations`);
  const verLocs = await all(`/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations`);
  console.log(`\nAplikacija ${BUNDLE}, verzija ${version.attributes.versionString}`);

  for (const [, loc] of LOCALES) {
    const t = texts[loc];
    // Name, subtitle and privacy URL can only change together with a new version; skip them if unchanged.
    const curInfo = infoLocs.find(x => x.attributes.locale === loc);
    const infoAttrs = { name: t.name, subtitle: t.subtitle, privacyPolicyUrl: URLS.privacyPolicyUrl };
    const same = curInfo && Object.entries(infoAttrs).every(([k, v]) => curInfo.attributes[k] === v);
    const a = same ? 'bez promjene' : await upsert(infoLocs, loc, 'appInfoLocalizations', 'appInfo', 'appInfos', info.id, infoAttrs);
    const attrs = { description: t.description, keywords: t.keywords, promotionalText: t.promotionalText, supportUrl: URLS.supportUrl, marketingUrl: URLS.marketingUrl };
    if (process.argv.includes('--whats-new')) attrs.whatsNew = t.whatsNew;
    const b = await upsert(verLocs, loc, 'appStoreVersionLocalizations', 'appStoreVersion', 'appStoreVersions', version.id, attrs);
    console.log(`  ${loc.padEnd(6)} naziv i podnaslov: ${a}; opis i ključne riječi: ${b}`);
  }
  const buildNo = arg('build');
  if (buildNo) {
    // A new upload shows up in the API after a few minutes and is processed in 5-30 minutes.
    const vs = version.attributes.versionString;
    let build = null;
    for (let t = 0; t < 90; t++) {
      const list = await all(`/v1/builds?filter[app]=${app.id}&filter[version]=${encodeURIComponent(buildNo)}&filter[preReleaseVersion.version]=${encodeURIComponent(vs)}`);
      build = list[0];
      const state = build ? build.attributes.processingState : 'NOT_UPLOADED_YET';
      if (state === 'VALID') break;
      if (state === 'INVALID' || state === 'FAILED') throw new Error(`Build ${buildNo}: obrada nije uspjela (${state}), vidi e-mail od Applea.`);
      console.log(`Build ${vs} (${buildNo}): ${state}, čekam...`);
      await new Promise(r => setTimeout(r, 60e3));
    }
    if (!build || build.attributes.processingState !== 'VALID') throw new Error(`Build ${buildNo} nije obrađen ni nakon 90 minuta.`);
    await api('PATCH', `/v1/appStoreVersions/${version.id}/relationships/build`, rel('builds', build.id));
    console.log(`Build ${vs} (${buildNo}) odabran za verziju ${vs}.`);
  }
  console.log('\nGotovo. Provjeri tekstove u App Store Connectu (kartica Distribution, svaki jezik gore desno).');
})().catch(e => { console.error('GREŠKA: ' + e.message); process.exit(1); });
