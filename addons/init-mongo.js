function seed(dbName, user, password) {
	db = db.getSiblingDB(dbName);
	db.createUser({
		user: user,
		pwd: password,
		roles: [{ role: 'readWrite', db: dbName }],
	});

	db.createCollection('api_keys');
	db.createCollection('roles');

	db.api_keys.insert({
		key: 'GCMUDiuY5a7WvyUNt9n3QztToSHzK7Uj',
		permissions: ['GENERAL'],
		comments: ['To be used by the xyz vendor'],
		version: 1,
		status: true,
		createdAt: new Date(),
		updatedAt: new Date(),
	});

	db.roles.insertMany([
		{
			code: 'LAB_ADMIN',
			status: true,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
		{
			code: 'DENTIST_ADMIN',
			status: true,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
		{
			code: 'DENTIST',
			status: true,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
	]);

	db.users.insert({
		name: 'Admin',
		email: 'admin@xyz.com',
		password: '$2a$10$psWmSrmtyZYvtIt/FuJL1OLqsK3iR1fZz5.wUYFuSNkkt.EOX9mLa', // hash of password: changeit
		role: db.roles
			.find({ code: 'LAB_ADMIN' })
			.toArray()
			.map((role) => role._id)[0],
		status: true,
		createdAt: new Date(),
		updatedAt: new Date(),
	});
}

seed('deutsche', 'deutsche-db-user', 'deutsche-db-user');
