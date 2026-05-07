import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IHttpRequestMethods,
	NodeApiError,
} from 'n8n-workflow';

export class Csv2Geo implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'CSV2GEO',
		name: 'csv2Geo',
		icon: 'file:csv2geo.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Geocode addresses to coordinates across 200+ countries',
		defaults: {
			name: 'CSV2GEO',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'csv2GeoApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Forward Geocode',
						value: 'forwardGeocode',
						description: 'Convert an address to latitude/longitude coordinates',
						action: 'Forward geocode an address',
					},
					{
						name: 'Reverse Geocode',
						value: 'reverseGeocode',
						description: 'Convert coordinates to a street address',
						action: 'Reverse geocode coordinates',
					},
					{
						name: 'Search Places',
						value: 'searchPlaces',
						description: 'Search 72M+ points of interest',
						action: 'Search places',
					},
					{
						name: 'Autocomplete',
						value: 'autocomplete',
						description: 'Get address suggestions for partial input',
						action: 'Autocomplete an address',
					},
					// Sprint 1.8 — Boundaries API
					{
						name: 'Postcode → Boundary',
						value: 'boundaryByPostcode',
						description: 'One-call: postcode → polygon, bbox, population, Wikidata',
						action: 'Lookup boundary by postcode',
					},
					{
						name: 'Walk Up Admin Chain',
						value: 'divisionAncestors',
						description: 'Walk parent_division_id from input up to country (Geoapify part-of parity)',
						action: 'Walk up admin chain for division',
					},
					{
						name: 'Consolidated City',
						value: 'divisionConsolidated',
						description: 'Resolve any of NYC\'s 5 boroughs into the canonical NYC entity + members',
						action: 'Lookup consolidated city',
					},
				],
				default: 'forwardGeocode',
			},
			// Forward Geocode fields
			{
				displayName: 'Address',
				name: 'address',
				type: 'string',
				default: '',
				placeholder: '1600 Pennsylvania Ave, Washington DC',
				description: 'The full address to geocode',
				required: true,
				displayOptions: {
					show: {
						operation: ['forwardGeocode'],
					},
				},
			},
			// Reverse Geocode fields
			{
				displayName: 'Latitude',
				name: 'latitude',
				type: 'number',
				default: 0,
				placeholder: '40.7484',
				description: 'Latitude coordinate (-90 to 90)',
				required: true,
				displayOptions: {
					show: {
						operation: ['reverseGeocode'],
					},
				},
			},
			{
				displayName: 'Longitude',
				name: 'longitude',
				type: 'number',
				default: 0,
				placeholder: '-73.9857',
				description: 'Longitude coordinate (-180 to 180)',
				required: true,
				displayOptions: {
					show: {
						operation: ['reverseGeocode'],
					},
				},
			},
			// Search Places fields
			{
				displayName: 'Query',
				name: 'query',
				type: 'string',
				default: '',
				placeholder: 'Starbucks',
				description: 'Name or type of place to search for',
				required: true,
				displayOptions: {
					show: {
						operation: ['searchPlaces'],
					},
				},
			},
			// Autocomplete fields
			{
				displayName: 'Partial Address',
				name: 'partialAddress',
				type: 'string',
				default: '',
				placeholder: '1600 Amphitheatre',
				description: 'Partial address to autocomplete',
				required: true,
				displayOptions: {
					show: {
						operation: ['autocomplete'],
					},
				},
			},
			// Sprint 1.8 — Boundaries fields
			{
				displayName: 'Postcode',
				name: 'postcode',
				type: 'string',
				default: '',
				placeholder: '90210',
				description: 'Postcode in any common format (90210, SW1A 1AA, K1A 0B1)',
				required: true,
				displayOptions: { show: { operation: ['boundaryByPostcode'] } },
			},
			{
				displayName: 'Country (ISO 3166-1 alpha-2)',
				name: 'boundaryCountry',
				type: 'string',
				default: 'US',
				placeholder: 'US',
				description: 'ISO 3166-1 alpha-2 country code',
				required: true,
				displayOptions: { show: { operation: ['boundaryByPostcode'] } },
			},
			{
				displayName: 'Division ID',
				name: 'divisionId',
				type: 'string',
				default: '',
				description: 'Overture ID of the division (get one from Postcode → Boundary first)',
				required: true,
				displayOptions: { show: { operation: ['divisionAncestors', 'divisionConsolidated'] } },
			},
			{
				displayName: 'Boundary Options',
				name: 'boundaryOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: { show: { operation: ['boundaryByPostcode', 'divisionAncestors', 'divisionConsolidated'] } },
				options: [
					{
						displayName: 'Include Geometry',
						name: 'includeGeometry',
						type: 'boolean',
						default: false,
						description: 'Whether to include the polygon as GeoJSON in the response',
					},
					{
						displayName: 'Polygon Precision',
						name: 'precision',
						type: 'options',
						default: 'med',
						options: [
							{ name: 'Low (~1KB)', value: 'low' },
							{ name: 'Med (~10KB, default)', value: 'med' },
							{ name: 'Full (source resolution)', value: 'full' },
						],
						description: 'Polygon detail tier — only meaningful when geometry is included',
					},
					{
						displayName: 'Max Depth (ancestors only)',
						name: 'maxDepth',
						type: 'number',
						default: 8,
						description: 'Hard cap on ancestor walk depth (1-12)',
					},
					{
						displayName: 'Language',
						name: 'lang',
						type: 'string',
						default: '',
						placeholder: 'de, ja, zh-Hant, pt-BR…',
						description: 'BCP-47 language tag — replaces division names with the Overture translation (Sprint 2.1). Empty = primary name. Falls back to base language when the region-specific tag is not in the data.',
					},
					{
						displayName: 'Include Other Names (translations map)',
						name: 'includeOtherNames',
						type: 'boolean',
						default: false,
						description: 'Whether to attach the full other_names map (~78 langs avg for top-level divisions). Useful for client-side language switching.',
					},
				],
			},
			// Shared fields
			{
				displayName: 'Country Code',
				name: 'country',
				type: 'string',
				default: '',
				placeholder: 'US',
				description: '2-letter ISO country code (e.g., US, GB, DE). Improves accuracy.',
				displayOptions: {
					show: {
						operation: ['forwardGeocode', 'searchPlaces', 'autocomplete'],
					},
				},
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: {
					show: {
						operation: ['searchPlaces', 'autocomplete'],
					},
				},
				options: [
					{
						displayName: 'Category',
						name: 'category',
						type: 'string',
						default: '',
						description: 'Filter by category (e.g., restaurant, hotel, hospital)',
					},
					{
						displayName: 'Limit',
						name: 'limit',
						type: 'number',
						default: 10,
						description: 'Maximum number of results',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const operation = this.getNodeParameter('operation', 0) as string;
		const credentials = await this.getCredentials('csv2GeoApi');

		for (let i = 0; i < items.length; i++) {
			try {
				let endpoint = '';
				const qs: Record<string, string | number> = {
					api_key: credentials.apiKey as string,
				};

				if (operation === 'forwardGeocode') {
					endpoint = '/geocode';
					qs.q = this.getNodeParameter('address', i) as string;
					const country = this.getNodeParameter('country', i, '') as string;
					if (country) qs.country = country;
				} else if (operation === 'reverseGeocode') {
					endpoint = '/reverse';
					qs.lat = this.getNodeParameter('latitude', i) as number;
					qs.lng = this.getNodeParameter('longitude', i) as number;
				} else if (operation === 'searchPlaces') {
					endpoint = '/places';
					qs.q = this.getNodeParameter('query', i) as string;
					const country = this.getNodeParameter('country', i, '') as string;
					if (country) qs.country = country;
					const additional = this.getNodeParameter('additionalFields', i, {}) as Record<string, any>;
					if (additional.category) qs.category = additional.category;
					if (additional.limit) qs.limit = additional.limit;
				} else if (operation === 'autocomplete') {
					endpoint = '/autocomplete';
					qs.q = this.getNodeParameter('partialAddress', i) as string;
					const country = this.getNodeParameter('country', i, '') as string;
					if (country) qs.country = country;
					const additional = this.getNodeParameter('additionalFields', i, {}) as Record<string, any>;
					if (additional.limit) qs.limit = additional.limit;
				} else if (operation === 'boundaryByPostcode') {
					endpoint = '/divisions/by-postcode';
					qs.code = this.getNodeParameter('postcode', i) as string;
					qs.country = this.getNodeParameter('boundaryCountry', i) as string;
					const opts = this.getNodeParameter('boundaryOptions', i, {}) as Record<string, any>;
					const includes: string[] = [];
					if (opts.includeGeometry) includes.push('geometry');
					if (opts.includeOtherNames) includes.push('other_names');
					if (includes.length) qs.include = includes.join(',');
					if (opts.precision) qs.precision = opts.precision;
					if (opts.lang) qs.lang = opts.lang;
				} else if (operation === 'divisionAncestors') {
					const id = this.getNodeParameter('divisionId', i) as string;
					endpoint = `/divisions/ancestors/${encodeURIComponent(id)}`;
					const opts = this.getNodeParameter('boundaryOptions', i, {}) as Record<string, any>;
					const includes: string[] = [];
					if (opts.includeGeometry) includes.push('geometry');
					if (opts.includeOtherNames) includes.push('other_names');
					if (includes.length) qs.include = includes.join(',');
					if (opts.precision) qs.precision = opts.precision;
					if (opts.maxDepth) qs.max_depth = opts.maxDepth;
					if (opts.lang) qs.lang = opts.lang;
				} else if (operation === 'divisionConsolidated') {
					const id = this.getNodeParameter('divisionId', i) as string;
					endpoint = `/divisions/consolidated/${encodeURIComponent(id)}`;
					const opts = this.getNodeParameter('boundaryOptions', i, {}) as Record<string, any>;
					const includes: string[] = [];
					if (opts.includeGeometry) includes.push('geometry');
					if (opts.includeOtherNames) includes.push('other_names');
					if (includes.length) qs.include = includes.join(',');
					if (opts.precision) qs.precision = opts.precision;
					if (opts.lang) qs.lang = opts.lang;
				}

				const response = await this.helpers.httpRequest({
					method: 'GET' as IHttpRequestMethods,
					url: `https://csv2geo.com/api/v1${endpoint}`,
					qs,
					json: true,
				});

				// Flatten the first result for forward/reverse geocode
				if ((operation === 'forwardGeocode' || operation === 'reverseGeocode') && response.results?.length > 0) {
					const r = response.results[0];
					returnData.push({
						json: {
							latitude: r.location?.lat,
							longitude: r.location?.lng,
							formatted_address: r.formatted_address,
							accuracy: r.accuracy,
							confidence: r.accuracy_score,
							house_number: r.components?.house_number,
							street: r.components?.street,
							city: r.components?.city,
							state: r.components?.state,
							postcode: r.components?.postcode,
							country: r.components?.country,
							source: r.source,
						},
						pairedItem: { item: i },
					});
				} else if (operation === 'searchPlaces' && response.results?.length > 0) {
					for (const place of response.results) {
						returnData.push({
							json: {
								id: place.id,
								name: place.name,
								category: place.category,
								latitude: place.location?.lat,
								longitude: place.location?.lng,
								address: place.address,
								city: place.city,
								state: place.state,
								postcode: place.postcode,
								country: place.country,
								phone: place.phone,
								website: place.website,
								brand: place.brand,
							},
							pairedItem: { item: i },
						});
					}
				} else if (operation === 'autocomplete' && response.suggestions?.length > 0) {
					for (const s of response.suggestions) {
						returnData.push({
							json: {
								formatted_address: s.formatted_address,
								latitude: s.location?.lat,
								longitude: s.location?.lng,
								house_number: s.components?.house_number,
								street: s.components?.street,
								city: s.components?.city,
								state: s.components?.state,
								postcode: s.components?.postcode,
								country: s.components?.country,
							},
							pairedItem: { item: i },
						});
					}
				} else if (operation === 'boundaryByPostcode' && response.result) {
					// Flatten the single result for downstream nodes.
					const r = response.result;
					returnData.push({
						json: {
							id: r.id,
							name: r.name,
							subtype: r.subtype,
							country: r.country,
							region: r.region,
							population: r.population,
							wikidata: r.wikidata,
							latitude: r.location?.lat,
							longitude: r.location?.lng,
							bbox: r.bbox,
							geometry: r.geometry,
							confidence: r.confidence,
						},
						pairedItem: { item: i },
					});
				} else if (operation === 'divisionAncestors' && response.results?.length > 0) {
					// One row per level — depth 0 = leaf, last = root.
					for (let d = 0; d < response.results.length; d++) {
						const r = response.results[d];
						returnData.push({
							json: {
								depth: d,
								id: r.id,
								name: r.name,
								subtype: r.subtype,
								country: r.country,
								region: r.region,
								population: r.population,
								wikidata: r.wikidata,
								parent_division_id: r.parent_division_id,
								bbox: r.bbox,
								geometry: r.geometry,
							},
							pairedItem: { item: i },
						});
					}
				} else if (operation === 'divisionConsolidated' && response.canonical) {
					returnData.push({
						json: {
							canonical_id: response.canonical.id,
							canonical_name: response.canonical.name,
							country: response.canonical.country,
							population: response.canonical.population,
							wikidata: response.canonical.wikidata,
							matched_as: response.matched_as,
							source: response.source,
							member_count: (response.members || []).length,
							members: response.members,
							bbox: response.canonical.bbox,
							geometry: response.canonical.geometry,
						},
						pairedItem: { item: i },
					});
				} else {
					returnData.push({
						json: response,
						pairedItem: { item: i },
					});
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				throw new NodeApiError(this.getNode(), error as any);
			}
		}

		return [returnData];
	}
}
