/**
 * Publications listed on physioshark.org (#59); metadata from Crossref. `moorea` marks papers built
 * on the Mo'orea nursery fieldwork this site visualises, with the most relevant page.
 */
export interface Publication {
	doi: string;
	authors: string;
	year: number;
	title: string;
	journal: string;
	moorea?: { href: string; label: string };
}

export const PUBLICATIONS: Publication[] = [
	{
		doi: '10.1071/MF24080',
		authors: 'Bouyoucos et al.',
		year: 2024,
		title:
			'No effects of abiotic and anthropogenic factors on reef-associated neonate shark abundance within a shark nursery-area system',
		journal: 'Marine and Freshwater Research',
		moorea: { href: '/pressure', label: 'Human pressure' }
	},
	{
		doi: '10.1038/s41598-019-49761-2',
		authors: 'Weideli et al.',
		year: 2019,
		title:
			'Same species, different prerequisites: investigating body condition and foraging success in young reef sharks between an atoll and an island system',
		journal: 'Scientific Reports',
		moorea: { href: '/morphometrics', label: 'Body size & condition' }
	},
	{
		doi: '10.1093/conphys/coz081',
		authors: 'Schwieterman et al.',
		year: 2019,
		title:
			'Analysing tropical elasmobranch blood samples in the field: blood stability during storage and validation of the HemoCue® haemoglobin analyser',
		journal: 'Conservation Physiology',
		moorea: { href: '/physiology', label: 'Physiology & lab' }
	},
	{
		doi: '10.1093/conphys/coy053',
		authors: 'Bouyoucos et al.',
		year: 2018,
		title:
			'Dead tired: evaluating the physiological status and survival of neonatal reef sharks under stress',
		journal: 'Conservation Physiology',
		moorea: { href: '/physiology', label: 'Physiology & lab' }
	},
	{
		doi: '10.1093/conphys/cov062',
		authors: 'Chin et al.',
		year: 2015,
		title:
			'Blacktip reef sharks (Carcharhinus melanopterus) show high capacity for wound healing and recovery following injury',
		journal: 'Conservation Physiology',
		moorea: { href: '/notes', label: 'Field notes' }
	},
	{
		doi: '10.1007/s11160-019-09553-3',
		authors: 'Bouyoucos et al.',
		year: 2019,
		title: 'Estimating oxygen uptake rates to understand stress in sharks and rays',
		journal: 'Reviews in Fish Biology and Fisheries'
	},
	{
		doi: '10.1007/s00227-018-3427-7',
		authors: 'Gervais et al.',
		year: 2018,
		title:
			'Too hot to handle? Using movement to alleviate effects of elevated temperatures in a benthic elasmobranch, Hemiscyllium ocellatum',
		journal: 'Marine Biology'
	},
	{
		doi: '10.1007/s12192-018-0892-3',
		authors: 'Lopes et al.',
		year: 2018,
		title:
			'Absence of cellular damage in tropical newly hatched sharks (Chiloscyllium plagiosum) under ocean acidification conditions',
		journal: 'Cell Stress and Chaperones'
	},
	{
		doi: '10.1093/conphys/cox012',
		authors: 'Talwar et al.',
		year: 2017,
		title: 'Validation of a portable, waterproof blood pH analyser for elasmobranchs',
		journal: 'Conservation Physiology'
	},
	{
		doi: '10.1098/rsbl.2016.0796',
		authors: 'Rosa et al.',
		year: 2017,
		title: 'Biological responses of sharks to ocean acidification',
		journal: 'Biology Letters'
	},
	{
		doi: '10.1007/s12526-015-0429-2',
		authors: 'Gervais et al.',
		year: 2016,
		title: 'Developing in warm water: irregular colouration and patterns of a neonate elasmobranch',
		journal: 'Marine Biodiversity'
	},
	{
		doi: '10.1093/conphys/cow003',
		authors: 'Johnson et al.',
		year: 2016,
		title:
			'Will ocean acidification affect the early ontogeny of a tropical oviparous elasmobranch (Hemiscyllium ocellatum)?',
		journal: 'Conservation Physiology'
	},
	{
		doi: '10.1093/icesjms/fsv085',
		authors: 'Heinrich et al.',
		year: 2016,
		title:
			'Foraging behaviour of the epaulette shark Hemiscyllium ocellatum is not affected by elevated CO2',
		journal: 'ICES Journal of Marine Science'
	},
	{
		doi: '10.1093/conphys/cou047',
		authors: 'Heinrich et al.',
		year: 2014,
		title:
			'A product of its environment: the epaulette shark (Hemiscyllium ocellatum) exhibits physiological tolerance to elevated environmental CO2',
		journal: 'Conservation Physiology'
	}
];
