/** Site navigation, grouped like physioshark.org's top menu. */
export interface NavItem {
	href: string;
	label: string;
	blurb: string;
}

export const NAV: { label: string; items: NavItem[] }[] = [
	{
		label: 'Explore',
		items: [
			{ href: '/', label: 'Overview', blurb: 'Thirteen seasons at a glance' },
			{ href: '/seasons', label: 'Seasons', blurb: 'Season-by-season report cards' },
			{ href: '/nurseries', label: 'Nurseries', blurb: 'Map and profiles of every nursery' },
			{ href: '/sharks', label: 'Sharks', blurb: 'Every tagged individual' },
			{ href: '/findings', label: 'Findings', blurb: 'Interesting, quirky and fun facts' }
		]
	},
	{
		label: 'Biology',
		items: [
			{
				href: '/morphometrics',
				label: 'Body size & condition',
				blurb: 'Lengths, mass, condition, sex ratios'
			},
			{ href: '/neonates', label: 'Newborns', blurb: 'Umbilical scars and birth timing' },
			{ href: '/growth', label: 'Growth', blurb: 'How fast pups grow between captures' },
			{ href: '/recaptures', label: 'Recaptures', blurb: 'Site fidelity and returning sharks' },
			{
				href: '/adults',
				label: 'Adult blacktips',
				blurb: 'Maturity, pregnancy and capture stress'
			},
			{ href: '/physiology', label: 'Physiology & lab', blurb: 'Blood, lab growth, feeding, diet' }
		]
	},
	{
		label: 'Environment',
		items: [
			{
				href: '/drivers',
				label: 'What drives catches?',
				blurb: 'Catch rate against every variable'
			},
			{
				href: '/ocean',
				label: 'Ocean & heat stress',
				blurb: 'Sea temperature, heatwaves, ENSO, waves'
			},
			{ href: '/weather', label: 'Weather', blurb: 'Air temperature, rain, wind, cloud' },
			{ href: '/tides', label: 'Tides', blurb: 'Sun-locked tides and catches' },
			{ href: '/moon', label: 'Moon', blurb: 'Lunar phase and illumination' },
			{ href: '/time-of-day', label: 'Time of day', blurb: 'When sharks hit the net' },
			{ href: '/pressure', label: 'Human pressure', blurb: 'Fishing, trampling, artificial coast' }
		]
	},
	{
		label: 'Fieldwork',
		items: [
			{
				href: '/effort',
				label: 'Sampling effort',
				blurb: 'Nets set, hours fished, zero-catch nights'
			},
			{ href: '/crew', label: 'Crew', blurb: 'Who has been out on the most nights' },
			{ href: '/water-quality', label: 'Water quality', blurb: 'Field and tank readings, loggers' },
			{ href: '/notes', label: 'Field notes', blurb: 'Every note from the logs, searchable' }
		]
	},
	{
		label: 'About',
		items: [
			{ href: '/about', label: 'About & methods', blurb: 'Data sources, methods, publications' },
			{
				href: '/data-quality',
				label: 'Data quality',
				blurb: 'What the importer noticed in the sheets'
			}
		]
	}
];
