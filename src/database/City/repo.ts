import City, { CityModel } from './model';

async function findByCountry(countryId: number): Promise<City[] | []> {
	return CityModel.find({ country: countryId })
		.select('_id name')
		.lean()
		.exec();
}

async function findById(id: number): Promise<City | null> {
	return CityModel.findOne({ _id: id }).lean().exec();
}

export default {
	findById,
	findByCountry,
};
