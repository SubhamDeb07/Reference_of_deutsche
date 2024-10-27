import request from 'request';
import { Currency } from '../database/Clinic/model';
import { apis as ApiConfig } from '../config/index';

export default async function currencyCalculator(
	from: Currency,
	to: Currency[],
): Promise<{ Currency: number }> {
	return new Promise((resolve, reject) => {
		const options = {
			method: 'GET',
			url: `https://api.currencybeacon.com/v1/latest?api_key=${
				ApiConfig.currencyApiKey
			}&base=${from}&symbols=${to.join(',')}`,
		};

		request(options, function (error, response, body) {
			const bodyData = JSON.parse(body);

			if (error) {
				reject(error);
			} else if (response.statusCode === 200 && bodyData && bodyData.response) {
				resolve(bodyData.response.rates);
			} else {
				reject(Error('something went wrong'));
			}
		});
	});
}
