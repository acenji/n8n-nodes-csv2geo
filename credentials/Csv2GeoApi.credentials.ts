import {
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class Csv2GeoApi implements ICredentialType {
	name = 'csv2GeoApi';
	displayName = 'CSV2GEO API';
	documentationUrl = 'https://csv2geo.com/api/docs';
	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			placeholder: 'geo_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
			description: 'Your CSV2GEO API key. Get one free at csv2geo.com/api-keys. Free tier: 1,000 requests/day.',
		},
	];
}
