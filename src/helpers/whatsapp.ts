import request from 'request';

export async function sendWhatsappMessage() {
	return new Promise((resolve, reject) => {
		const resData = {
			status: false,
			answare: '',
		};

		const options = {
			method: 'POST',
			url: 'https://graph.facebook.com/v17.0/190758684116643/messages',
			headers: {
				Authorization: `Bearer EAAFMYlPHaJsBOZCwBkzo373PBWxUU2bH28Lh0fnkzuAqqdDvqj6lpYtfw34dd6kjGIlmlv3OHVe7CbS1bZAOrJ6vGo9X9iHrIlFyuICRhZBz02kVHUD6DG7x3ZCZBk0RMbrcUZCqSlSBZBS8ixfIucbdL0Uow3ZC4jGZBrbwJL7gpC60pHlSybJoak1cb03aga1xv`,
				'Content-Type': 'application/json',
			},
			body: {
				messaging_product: 'whatsapp',
				to: '+918884036192',
				type: 'template',
				template: {
					name: 'hello_world',
					language: {
						code: 'en_US',
					},
				},
			},
			json: true,
		};
		// const options = {
		// 	method: 'POST',
		// 	url: 'https://graph.facebook.com/v17.0/190758684116643/messages',
		// 	headers: {
		// 		Authorization: `Bearer ${process.env.SECRET_KEY as string}`,
		// 		'Content-Type': 'application/json',
		// 	},
		// 	body: {
		// 		messaging_product: 'whatsapp',
		// 		recipient_type: 'individual',
		// 		to: process.env.TO as string,
		// 		type: 'text',
		// 		text: {
		// 			// the text object
		// 			preview_url: false,
		// 			body: 'MESSAGE_CONTENT',
		// 		},
		// 	},
		// 	json: true,
		// };

		request(options, (error, response, body) => {
			if (error) {
				resData.status = false;
				resData.answare = error.message;
				reject(resData);
			} else {
				resData.status = true;
				resData.answare = body;
				console.log(JSON.stringify(resData));
				resolve(resData);
			}
		});
	});
}
