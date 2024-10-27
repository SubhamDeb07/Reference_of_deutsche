module.exports = {
	apps: [
		{
			name: 'deutsche-server',
			script: 'build/server.js',
			node_args: '-r dotenv/config',
		},
	],
};
