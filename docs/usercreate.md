# Documentation for User Creation

## Purpose

This document explains the process for creating new users through an administrative interface in a DA portal. The process ensures data validation, unique identifier assignment.

### Validation and Processing

- **Data Validation:** The API validates the input data for completeness and correctness.
- **Password Generation:** Upon successful validation, a random password is generated using a cryptographic library.

### Database Interaction

- **User Data Storage:** Validated and processed data, along with the password, are stored in the MongoDB database.
- **Trigger Activation:** Post storage, a MongoDB Atlas trigger is activated which automatically assigns a unique `userid` to the new user by incrementing the last user's `userid`.

### MongoDB Atlas Trigger Function

The MongoDB Atlas trigger function is designed to automatically assign an incremented `userid` to each new user document inserted into the database.

### Trigger Function Code

```javascript
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
};
```

## 5. Automated Responses

- **Success:** On successful creation of the user, the API sends a confirmation response to the admin and triggers an email to the user containing the generated password.
- **Failure:** If the process encounters errors (e.g., validation fails, email already exists), an error message is returned detailing the reason for the failure.

## 6. Email Notification

An automated email is sent to the user containing the newly generated password with instructions for first-time login and password update.
