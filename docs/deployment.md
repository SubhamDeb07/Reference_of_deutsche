# Project Setup Documentation

## Setup Database (MongoDB)

Create MongoDB Cluster in MongoDB Atlas and Add Default Data with Action Trigger to Update UserId

1. Create an account or log in to your existing MongoDB Atlas account.
2. Choose your preferred cloud provider and region. Configure the cluster size and other settings as per your requirement.
3. Set up network access and create database users. Ensure IP whitelisting is configured for secure access.
4. Copy the connection string provided by Atlas to connect your application to the MongoDB cluster.
5. Import default data from csv files located in branch data.
6. Add trigger function to updated userid on insert data.

```js
exports = async function(changeEvent) {
  var docId = changeEvent.fullDocument._id;
  const countercollection = context.services.get(/*database name*/).db(changeEvent.ns.db).collection("userCounters");
  const usercollection = context.services.get(/*database name*/).db(changeEvent.ns.db).collection(changeEvent.ns.coll);
  
  let document = await countercollection.findOne({ _id: changeEvent.ns });
  let currentValue = document.seq_value;
  
  const numericValue = parseInt(currentValue) + 1;

  const formattedValue = String(numericValue).padStart(7, '0');

  var counter = await countercollection.findOneAndUpdate({_id: changeEvent.ns },{ $set: { seq_value: formattedValue }}, { returnNewDocument: true, upsert : true});
  var updateRes = await usercollection.updateOne({_id : docId},{ $set : {userId : counter.seq_value}});
  
  console.log(`Updated ${JSON.stringify(changeEvent.ns)} with counter ${counter.seq_value}`);
};
```

## S3 buckets for uploading presentation and assets

1. Login to your AWS console create buckets
2. Create an S3 Bucket:
   - Navigate to the S3 service in the AWS Management Console.
   - Click on “Create bucket” and follow the steps to set up a new bucket.

3. Configure Bucket Permissions:
   - Ensure that your bucket has the appropriate permissions for file uploading and access management.

4. Generate Access Keys:
   - Create new IAM (AWS Identity and Access Management) user with programmatic access.
   - Assign necessary permissions for S3 access and note down the access key ID and secret access key.

## Setup AWS email service

- In the AWS Management Console, navigate to the SES service.
- Go to the 'Email Addresses' section under 'Identity Management' and click on 'Verify a New Email Address'.
- Enter the email address and follow the instructions in the verification email you receive.
- Move out of sandbox by filling out the SES Limit Increase form, explaining your use case and email sending requirements.

## Currency converter

- Create / Login to currency beacon account [Currency Beacon](https://currencybeacon.com/account/dashboard)
- Get api key.

## EC2 Setup

1. **Launch EC2 Instance:**
   - Launch an EC2 instance on AWS with Ubuntu 22.04.
   - Configure security groups to allow specific traffic (like HTTP, HTTPS, SSH).

2. **Install Node.js 18 and PM2:**
   - Follow the tutorial: [Install Nodejs on Ubuntu](https://www.digitalocean.com/community/tutorials/how-to-install-node-js-on-ubuntu-22-04) follow option 2.
   - `sudo npm install -g pm2`

3. **Redis Installation and Configuration**
   - Follow the tutorial: [Configure Redis on ubuntu](https://redis.io/docs/install/install-redis/install-redis-on-linux).
   - Set password.

4. **Configure Nginx**
   - Follow the tutorial: [Configure Nginx on Ubuntu](https://www.digitalocean.com/community/tutorials/how-to-install-nginx-on-ubuntu-20-04)
   - Server block

   ```js
    server {
      listen 80;
      server_name <domainname / ip>;

      location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;

        error_page 500 502 503 504 /50x.html;
        location = /50x.html {
          root /usr/share/nginx/html;
        }
      }
    }
   ```

5. **Generate SSH key pair:**
   - Create ssh-key pair using key-gen.
   - Add public key to authorized_keys file.

6. **Create Directory and .env File:**
   - `mkdir /apps/deutsche`
   - `cd /apps/deutsche && touch .env`
   - copy .env.example into .env.
   - update all values.

## Update GitHub Secret Keys

- In your GitHub repository, go to Settings > Secrets.
- Add variables
  1. PROD_EC2_HOST - EC2 ip address
  2. PROD_EC2_USER - EC2 username (default ubuntu)
  3. PROD_SSH_PRIVATE_KEY - SSH key previously generated.
