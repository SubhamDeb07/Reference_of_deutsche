import cron from 'node-cron';
import Logger from '../core/Logger';
import { Currency } from '../database/Clinic/model';
import convertCurrency from '../helpers/convertCurrency';
import { setJson } from '../cache/query';
import { DynamicKey, getDynamicKey } from '../cache/keys';

export const currencyJob = cron.schedule('30 * * * *', async () => {
	try {
		const currencies = Object.values(Currency);

		for (const currency of currencies) {
			const convertedData = await convertCurrency(currency, currencies);

			await setJson(
				getDynamicKey(DynamicKey.EXCHANGE_RATES, currency),
				convertedData,
			);
		}
	} catch (error) {
		Logger.error(error);
	}
	// {
	// 	scheduled: true,
	// 	timezone: 'Your/Timezone',
	// },
});
