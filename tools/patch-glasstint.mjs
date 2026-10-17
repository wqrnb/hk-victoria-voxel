import fs from 'node:fs';
let s = fs.readFileSync('js/main.js','utf8');
s = s.replace("HK.Buildings.update(dt, { night: env.night, horizonColor: env.horizonColor, colorsLinear: true });",
              "HK.Buildings.update(dt, { night: env.night, horizonColor: (env.glassTint || env.horizonColor), zenithColor: env.zenithColor, colorsLinear: true });");
s = s.replace("try { HK.Buildings.update(0.016, { night: env0.night, horizonColor: env0.horizonColor, colorsLinear: true }); } catch (e) {}",
              "try { HK.Buildings.update(0.016, { night: env0.night, horizonColor: (env0.glassTint || env0.horizonColor), zenithColor: env0.zenithColor, colorsLinear: true }); } catch (e) {}");
fs.writeFileSync('js/main.js', s);
console.log('glassTint wired');
