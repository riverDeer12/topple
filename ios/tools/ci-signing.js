#!/usr/bin/env node
// Temporary signing for a store build on CI (GitHub Actions, macOS), through the App Store Connect API.
// Node 18+, no npm.
//
//   node ios/tools/ci-signing.js create --key K.p8 --key-id X --issuer Y --csr csr.pem --out DIR
//     Creates an Apple Distribution certificate from the CSR and an App Store provisioning profile
//     for software.rdd.topple with it. Writes DIR/cert.cer, DIR/profile.mobileprovision and
//     DIR/ids.json ({certId, profileId, profileName}).
//   node ios/tools/ci-signing.js delete --key K.p8 --key-id X --issuer Y --out DIR
//     Deletes that profile and revokes that certificate again (builds already uploaded stay valid).
//
// The API key needs the Admin role (creating certificates). An account can have only a few
// distribution certificates, so the workflow always deletes its own one at the end.
const fs = require('fs');
const path = require('path');
const { arg, api, rel } = require('./asc.js');

const BUNDLE = arg('bundle') || 'software.rdd.topple';
const OUT = arg('out');
const cmd = process.argv[2];

(async () => {
  if (!OUT) throw new Error('Nedostaje --out.');
  const idsFile = path.join(OUT, 'ids.json');
  if (cmd === 'create') {
    const csr = fs.readFileSync(arg('csr'), 'utf8').replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
    const cert = (await api('POST', '/v1/certificates', { data: { type: 'certificates', attributes: { certificateType: 'DISTRIBUTION', csrContent: csr } } })).data;
    const ids = { certId: cert.id };
    fs.writeFileSync(idsFile, JSON.stringify(ids));
    fs.writeFileSync(path.join(OUT, 'cert.cer'), Buffer.from(cert.attributes.certificateContent, 'base64'));
    const bundles = await api('GET', `/v1/bundleIds?filter[identifier]=${encodeURIComponent(BUNDLE)}&filter[platform]=IOS`);
    const bundle = bundles.data.find(b => b.attributes.identifier === BUNDLE);
    if (!bundle) throw new Error(`Nema App ID-ja ${BUNDLE}.`);
    const name = `Topple CI ${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}`;
    const profile = (await api('POST', '/v1/profiles', { data: { type: 'profiles', attributes: { name, profileType: 'IOS_APP_STORE' }, relationships: { bundleId: rel('bundleIds', bundle.id), certificates: { data: [{ type: 'certificates', id: cert.id }] } } } })).data;
    Object.assign(ids, { profileId: profile.id, profileName: name, profileUuid: profile.attributes.uuid });
    fs.writeFileSync(idsFile, JSON.stringify(ids));
    fs.writeFileSync(path.join(OUT, 'profile.mobileprovision'), Buffer.from(profile.attributes.profileContent, 'base64'));
    console.log(`Certifikat ${cert.id} i profil „${name}” napravljeni.`);
  } else if (cmd === 'delete') {
    if (!fs.existsSync(idsFile)) return console.log('Nema ničega za brisanje.');
    const ids = JSON.parse(fs.readFileSync(idsFile, 'utf8'));
    if (ids.profileId) await api('DELETE', `/v1/profiles/${ids.profileId}`).catch(e => console.log(e.message));
    if (ids.certId) await api('DELETE', `/v1/certificates/${ids.certId}`).catch(e => console.log(e.message));
    console.log('Privremeni certifikat i profil obrisani.');
  } else throw new Error('Naredba: create ili delete.');
})().catch(e => {
  console.error('GREŠKA: ' + e.message);
  if (/certificate/i.test(e.message) && /limit|maximum|already/i.test(e.message))
    console.error('Na računu je previše distribucijskih certifikata: na developer.apple.com → Certificates opozovi neki stari „Topple CI”.');
  process.exit(1);
});
