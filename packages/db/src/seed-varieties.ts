import { db } from './index.js';
import { cropVarieties } from './schema/varieties.js';

// Punjab major varieties for the 6 staple profiles covered in CROP_LIBRARY.
// Run after the main seed so cropProfileCode strings have matching profiles.

type VarietySeed = {
  cropProfileCode: string;
  name: string;
  nameUr?: string;
  varietyKind?:
    | 'open_pollinated'
    | 'hybrid'
    | 'f1'
    | 'desi'
    | 'imported'
    | 'heirloom';
  sourceCompany?: string;
  releaseYear?: number;
  resistanceTraits?: string[];
  recommendedForZones?: string[];
};

const VARIETIES: VarietySeed[] = [
  // Wheat
  { cropProfileCode: 'wheat', name: 'Galaxy-2013', varietyKind: 'open_pollinated', sourceCompany: 'AARI Faisalabad', releaseYear: 2013, resistanceTraits: ['yellow_rust'], recommendedForZones: ['central_punjab'] },
  { cropProfileCode: 'wheat', name: 'Akbar-2019', varietyKind: 'open_pollinated', sourceCompany: 'AARI Faisalabad', releaseYear: 2019, resistanceTraits: ['yellow_rust', 'leaf_rust'] },
  { cropProfileCode: 'wheat', name: 'Faisalabad-2008', varietyKind: 'open_pollinated', sourceCompany: 'AARI Faisalabad', releaseYear: 2008 },
  { cropProfileCode: 'wheat', name: 'Anaj-2017', varietyKind: 'open_pollinated', sourceCompany: 'NIAB', releaseYear: 2017 },
  { cropProfileCode: 'wheat', name: 'NARC-2009', varietyKind: 'open_pollinated', sourceCompany: 'NARC', releaseYear: 2009, resistanceTraits: ['drought_tolerance'] },
  { cropProfileCode: 'wheat', name: 'Punjab-2011', varietyKind: 'open_pollinated', sourceCompany: 'AARI Faisalabad', releaseYear: 2011 },

  // Rice
  { cropProfileCode: 'rice', name: 'Super Basmati', nameUr: 'سپر باسمتی', varietyKind: 'open_pollinated', sourceCompany: 'KSK', resistanceTraits: ['aroma_premium'] },
  { cropProfileCode: 'rice', name: 'Kissan Basmati', varietyKind: 'open_pollinated', sourceCompany: 'RRI Kala Shah Kaku' },
  { cropProfileCode: 'rice', name: 'KSK-133', varietyKind: 'open_pollinated', sourceCompany: 'RRI Kala Shah Kaku', releaseYear: 2018 },
  { cropProfileCode: 'rice', name: 'PK-1121', varietyKind: 'open_pollinated', sourceCompany: 'RRI Kala Shah Kaku', resistanceTraits: ['long_grain'] },

  // Cotton
  { cropProfileCode: 'cotton', name: 'CIM-616', varietyKind: 'open_pollinated', sourceCompany: 'CCRI Multan', releaseYear: 2014, resistanceTraits: ['clcv'] },
  { cropProfileCode: 'cotton', name: 'Sitara-008', varietyKind: 'open_pollinated', sourceCompany: 'CRI Multan' },
  { cropProfileCode: 'cotton', name: 'FH-Lalazar', varietyKind: 'open_pollinated', sourceCompany: 'CRI Faisalabad', resistanceTraits: ['heat_tolerance'] },
  { cropProfileCode: 'cotton', name: 'MNH-988', varietyKind: 'open_pollinated', sourceCompany: 'CRS Multan' },

  // Maize
  { cropProfileCode: 'maize', name: 'Pioneer P1543', varietyKind: 'hybrid', sourceCompany: 'Pioneer', resistanceTraits: ['drought_tolerance'] },
  { cropProfileCode: 'maize', name: 'Monsanto DK 6789', varietyKind: 'hybrid', sourceCompany: 'Bayer/Monsanto' },
  { cropProfileCode: 'maize', name: 'Karnak', varietyKind: 'hybrid', sourceCompany: 'Syngenta' },
  { cropProfileCode: 'maize', name: 'NK-8711', varietyKind: 'hybrid', sourceCompany: 'Syngenta' },

  // Sugarcane
  { cropProfileCode: 'sugarcane', name: 'CPF-247', varietyKind: 'open_pollinated', sourceCompany: 'SRI Faisalabad', resistanceTraits: ['red_rot'] },
  { cropProfileCode: 'sugarcane', name: 'HSF-240', varietyKind: 'open_pollinated', sourceCompany: 'SRI Faisalabad' },

  // Berseem
  { cropProfileCode: 'berseem', name: 'Lagani', varietyKind: 'open_pollinated' },
  { cropProfileCode: 'berseem', name: 'Anmol', varietyKind: 'open_pollinated' },
];

async function main() {
  console.log(`Seeding ${VARIETIES.length} crop varieties...`);
  for (const v of VARIETIES) {
    await db.insert(cropVarieties).values(v).onConflictDoNothing();
  }
  console.log('Variety seed complete.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
