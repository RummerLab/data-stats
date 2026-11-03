/**
 * Physioshark publications (#59); metadata from Crossref and the RummerLab website. `moorea`
 * marks papers built on the Mo'orea nursery fieldwork this site visualises, with the most
 * relevant page. `pdf` is the file name served at rummerlab.com/papers/. Chart cards cite papers
 * by `id` (`ChartCard papers`), so a chart links to the study that analysed the same question.
 */
export interface Publication {
	id: string;
	doi: string;
	authors: string;
	year: number;
	title: string;
	journal: string;
	pdf?: string;
	moorea?: { href: string; label: string };
}

const LIST = [
	{
		id: 'debaere2025injuries',
		doi: '10.1111/jfb.16059',
		authors: 'Debaere et al.',
		year: 2025,
		title: 'The costs and healing rates of minor injuries in neonatal reef sharks',
		journal: 'Journal of Fish Biology',
		pdf: 'Debaere et al., 2025 J Fish Biology.pdf',
		moorea: { href: '/neonates', label: 'Newborns' }
	},
	{
		id: 'lionnet2025photoid',
		doi: '10.1111/jfb.70114',
		authors: 'Lionnet et al.',
		year: 2025,
		title:
			"A blacktip's black tip: the reliability of using dorsal-fin patterns for photo identification of blacktip reef sharks (Carcharhinus melanopterus)",
		journal: 'Journal of Fish Biology',
		pdf: 'Lionnet et al., 2025 JFB.pdf',
		moorea: { href: '/recaptures', label: 'Recaptures' }
	},
	{
		id: 'mcinturf2025aggregation',
		doi: '10.1002/ece3.71107',
		authors: 'McInturf et al.',
		year: 2025,
		title: 'Catch data can unravel elasmobranch aggregation dynamics and group behaviours',
		journal: 'Ecology and Evolution',
		pdf: 'McInturf et al., 2025 Ecology and Evolution .pdf',
		moorea: { href: '/time-of-day', label: 'Time of day' }
	},
	{
		id: 'trujillo2025shallows',
		doi: '10.1093/conphys/coaf045',
		authors: 'Trujillo et al.',
		year: 2025,
		title:
			'Safety in the shallows: nearshore coastal habitats can provide physical and thermal features that optimize escape performance in newborn blacktip reef sharks (Carcharhinus melanopterus)',
		journal: 'Conservation Physiology',
		pdf: 'Trujillo et al., 2025 Conservation Physiology.pdf',
		moorea: { href: '/water-quality', label: 'Water quality' }
	},
	{
		id: 'bouyoucos2024abiotic',
		doi: '10.1071/MF24080',
		authors: 'Bouyoucos et al.',
		year: 2024,
		title:
			'No effects of abiotic and anthropogenic factors on reef-associated neonate shark abundance within a shark nursery-area system',
		journal: 'Marine and Freshwater Research',
		pdf: 'Bouyoucos et al., 2024 MFR.pdf',
		moorea: { href: '/pressure', label: 'Human pressure' }
	},
	{
		id: 'debaere2024lunar',
		doi: '10.1007/s00338-024-02534-4',
		authors: 'Debaere et al.',
		year: 2024,
		title:
			'The lunar cycle does not influence catch rates or foraging success of neonatal reef sharks in an amphidromic nursery system',
		journal: 'Coral Reefs',
		pdf: 'Debaere et al., 2024 Coral Reefs.pdf',
		moorea: { href: '/moon', label: 'Moon' }
	},
	{
		id: 'eustache2024density',
		doi: '10.1111/jfb.15569',
		authors: 'Eustache et al.',
		year: 2024,
		title:
			'Spatial and temporal analysis of juvenile blacktip reef shark (Carcharhinus melanopterus) demographies identifies critical habitats',
		journal: 'Journal of Fish Biology',
		pdf: 'Eustache et al., 2024 J Fish Biol.pdf',
		moorea: { href: '/nurseries', label: 'Nurseries' }
	},
	{
		id: 'debaere2023umbilicus',
		doi: '10.1093/conphys/coad028',
		authors: 'Debaere et al.',
		year: 2023,
		title:
			'Quantifying changes in umbilicus size to estimate the relative age of neonatal blacktip reef sharks (Carcharhinus melanopterus)',
		journal: 'Conservation Physiology',
		pdf: 'Debaere et al., 2023 Conservation Physiology.pdf',
		moorea: { href: '/neonates', label: 'Newborns' }
	},
	{
		id: 'eustache2023philopatry',
		doi: '10.1038/s41598-023-40140-6',
		authors: 'Eustache et al.',
		year: 2023,
		title:
			'Genetic evidence for plastic reproductive philopatry and matrotrophy in blacktip reef sharks (Carcharhinus melanopterus) of the Moorea Island (French Polynesia)',
		journal: 'Scientific Reports',
		pdf: 'Eustache et al., 2023 Sci Rep.pdf',
		moorea: { href: '/adults', label: 'Adult blacktips' }
	},
	{
		id: 'bouyoucos2022nursery',
		doi: '10.3354/meps13941',
		authors: 'Bouyoucos et al.',
		year: 2022,
		title:
			'Thermally insensitive physiological performance allows neonatal sharks to use coastal habitats as nursery areas',
		journal: 'Marine Ecology Progress Series',
		pdf: 'Bouyoucos et al., 2022 MEPS.pdf',
		moorea: { href: '/growth', label: 'Growth' }
	},
	{
		id: 'trujillo2022escape',
		doi: '10.1242/jeb.243973',
		authors: 'Trujillo et al.',
		year: 2022,
		title:
			'Escape response kinematics in two species of tropical shark: short escape latencies and high turning performance',
		journal: 'Journal of Experimental Biology',
		pdf: 'Trujillo et al., 2022 JEB.pdf',
		moorea: { href: '/physiology', label: 'Physiology & lab' }
	},
	{
		id: 'bouyoucos2021oxygen',
		doi: '10.1016/j.scitotenv.2021.146854',
		authors: 'Bouyoucos et al.',
		year: 2021,
		title:
			'Investigating links between thermal tolerance and oxygen supply capacity in shark neonates from a hyperoxic tropical environment',
		journal: 'Science of the Total Environment',
		pdf: 'Bouyoucos et al., 2021 STOTEN.pdf',
		moorea: { href: '/water-quality', label: 'Water quality' }
	},
	{
		id: 'schoen2021heatwave',
		doi: '10.1093/conphys/coab067',
		authors: 'Schoen et al.',
		year: 2021,
		title:
			'Simulated heatwave and fishing stressors alter corticosteroid and energy balance in neonate blacktip reef sharks, Carcharhinus melanopterus',
		journal: 'Conservation Physiology',
		pdf: 'Schoen et al., 2021 CP.pdf',
		moorea: { href: '/ocean', label: 'Ocean & heat stress' }
	},
	{
		id: 'bouyoucos2020sharkparks',
		doi: '10.1093/oso/9780198843610.003.0011',
		authors: 'Bouyoucos & Rummer',
		year: 2020,
		title:
			"Improving 'shark park' protections under threat from climate change using the conservation physiology toolbox",
		journal: 'Conservation Physiology (Oxford University Press)',
		pdf: 'Bouyoucos and Rummer 2020 Conservation physiology- Integrating physiology into animal conservation and management. .pdf',
		moorea: { href: '/ocean', label: 'Ocean & heat stress' }
	},
	{
		id: 'bouyoucos2020homerange',
		doi: '10.1007/s00338-020-01965-z',
		authors: 'Bouyoucos et al.',
		year: 2020,
		title:
			'Home range of newborn blacktip reef sharks (Carcharhinus melanopterus), as estimated using mark-recapture and acoustic telemetry',
		journal: 'Coral Reefs',
		pdf: 'Bouyoucos et al., 2020 Coral Reefs.pdf',
		moorea: { href: '/recaptures', label: 'Recaptures' }
	},
	{
		id: 'bouyoucos2020thermal',
		doi: '10.1242/jeb.221937',
		authors: 'Bouyoucos et al.',
		year: 2020,
		title:
			'Thermal tolerance and hypoxia tolerance are associated in blacktip reef shark (Carcharhinus melanopterus) neonates',
		journal: 'Journal of Experimental Biology',
		pdf: 'Bouyoucos et al., 2020 JEB.pdf',
		moorea: { href: '/water-quality', label: 'Water quality' }
	},
	{
		id: 'weideli2019condition',
		doi: '10.1038/s41598-019-49761-2',
		authors: 'Weideli et al.',
		year: 2019,
		title:
			'Same species, different prerequisites: investigating body condition and foraging success in young reef sharks between an atoll and an island system',
		journal: 'Scientific Reports',
		moorea: { href: '/morphometrics', label: 'Body size & condition' }
	},
	{
		id: 'schwieterman2019blood',
		doi: '10.1093/conphys/coz081',
		authors: 'Schwieterman et al.',
		year: 2019,
		title:
			'Analysing tropical elasmobranch blood samples in the field: blood stability during storage and validation of the HemoCue® haemoglobin analyser',
		journal: 'Conservation Physiology',
		moorea: { href: '/physiology', label: 'Physiology & lab' }
	},
	{
		id: 'bouyoucos2018deadtired',
		doi: '10.1093/conphys/coy053',
		authors: 'Bouyoucos et al.',
		year: 2018,
		title:
			'Dead tired: evaluating the physiological status and survival of neonatal reef sharks under stress',
		journal: 'Conservation Physiology',
		pdf: 'Bouyoucos et al., 2018 ConPhys.pdf',
		moorea: { href: '/physiology', label: 'Physiology & lab' }
	},
	{
		id: 'gervais2016colouration',
		doi: '10.1007/s12526-015-0429-2',
		authors: 'Gervais et al.',
		year: 2016,
		title: 'Developing in warm water: irregular colouration and patterns of a neonate elasmobranch',
		journal: 'Marine Biodiversity',
		pdf: 'Gervais et al. 2016.pdf'
	},
	{
		id: 'chin2015wounds',
		doi: '10.1093/conphys/cov062',
		authors: 'Chin et al.',
		year: 2015,
		title:
			'Blacktip reef sharks (Carcharhinus melanopterus) show high capacity for wound healing and recovery following injury',
		journal: 'Conservation Physiology',
		pdf: 'Chin et al., 2015 Cons Physiol.pdf',
		moorea: { href: '/notes', label: 'Field notes' }
	},
	{
		id: 'bouyoucos2019oxygen',
		doi: '10.1007/s11160-019-09553-3',
		authors: 'Bouyoucos et al.',
		year: 2019,
		title: 'Estimating oxygen uptake rates to understand stress in sharks and rays',
		journal: 'Reviews in Fish Biology and Fisheries',
		pdf: 'Bouyoucos et al., 2019.pdf'
	},
	{
		id: 'gervais2018movement',
		doi: '10.1007/s00227-018-3427-7',
		authors: 'Gervais et al.',
		year: 2018,
		title:
			'Too hot to handle? Using movement to alleviate effects of elevated temperatures in a benthic elasmobranch, Hemiscyllium ocellatum',
		journal: 'Marine Biology'
	},
	{
		id: 'lopes2018acidification',
		doi: '10.1007/s12192-018-0892-3',
		authors: 'Lopes et al.',
		year: 2018,
		title:
			'Absence of cellular damage in tropical newly hatched sharks (Chiloscyllium plagiosum) under ocean acidification conditions',
		journal: 'Cell Stress and Chaperones'
	},
	{
		id: 'talwar2017ph',
		doi: '10.1093/conphys/cox012',
		authors: 'Talwar et al.',
		year: 2017,
		title: 'Validation of a portable, waterproof blood pH analyser for elasmobranchs',
		journal: 'Conservation Physiology'
	},
	{
		id: 'rosa2017acidification',
		doi: '10.1098/rsbl.2016.0796',
		authors: 'Rosa et al.',
		year: 2017,
		title: 'Biological responses of sharks to ocean acidification',
		journal: 'Biology Letters'
	},
	{
		id: 'johnson2016ontogeny',
		doi: '10.1093/conphys/cow003',
		authors: 'Johnson et al.',
		year: 2016,
		title:
			'Will ocean acidification affect the early ontogeny of a tropical oviparous elasmobranch (Hemiscyllium ocellatum)?',
		journal: 'Conservation Physiology',
		pdf: 'Johnson et al., 2016 Conserv Physiol.pdf'
	},
	{
		id: 'heinrich2016foraging',
		doi: '10.1093/icesjms/fsv085',
		authors: 'Heinrich et al.',
		year: 2016,
		title:
			'Foraging behaviour of the epaulette shark Hemiscyllium ocellatum is not affected by elevated CO2',
		journal: 'ICES Journal of Marine Science',
		pdf: 'Heinrich et al., 2015.pdf'
	},
	{
		id: 'heinrich2014co2',
		doi: '10.1093/conphys/cou047',
		authors: 'Heinrich et al.',
		year: 2014,
		title:
			'A product of its environment: the epaulette shark (Hemiscyllium ocellatum) exhibits physiological tolerance to elevated environmental CO2',
		journal: 'Conservation Physiology',
		pdf: 'Heinrich et al., 2014 Cons. Physiol..pdf'
	}
] as const satisfies readonly Publication[];

export const PUBLICATIONS: readonly Publication[] = LIST;

export type PaperId = (typeof LIST)[number]['id'];

const byId = new Map<string, Publication>(PUBLICATIONS.map((p) => [p.id, p]));

export const paper = (id: PaperId): Publication => byId.get(id)!;

/** The PDF on rummerlab.com when the lab hosts one, otherwise the DOI. */
export const paperHref = (p: Publication) =>
	p.pdf ? `https://rummerlab.com/papers/${encodeURIComponent(p.pdf)}` : `https://doi.org/${p.doi}`;
