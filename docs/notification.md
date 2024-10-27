# Notification System Documentation

## 1. Overview

This document provides an overview and technical details of the notification system designed to dispatch notifications via email and socket notifications, and log them in a MongoDB database, using a Node.js backend with BullMQ, Node.js Events, and Socket.IO.

## 2. Process Flow

### 2.1 API Interaction

- **Triggering Event**: An event is triggered after an API call is made if the logic determines that a notification should be sent post-response.

### 2.2 Event Handling

- **Data Handling**: The triggered event collects necessary data and creates a message payload for the required notification type (email or socket).

### 2.3 Queue Management

- **Job Queuing**: The message is then sent to a BullMQ notification queue, where it is processed depending on whether it's an email or a socket notification.

### 2.4 Notification Dispatch

- **Types of Notifications**:
  - **Email Notification**: Processed by an email service to send messages.
  - **Socket Notification**: Sent through Socket.IO for real-time communication.

### 2.5 Database Logging

- **Storing Notifications**: Every notification is recorded in MongoDB with its content and a read status (`read: false` by default).

## 3. Notification Templates

Notification templates are managed in a class for ease of maintenance and reusability. Templates are defined for various roles and notification types, as shown below.

### 3.1 Template Structure Example

```javascript
{
  [TemplateName.quoteApproved]: {
    [RoleCode.DENTIST]: {
      [TemplateType.NOTIFICATION]: `Your custom aligner quote, as requested for Patient ID ${TemplateField.PatientId}, is now ready for review.`,
      [TemplateType.WHATSAPP]: `Hello ${TemplateField.RecipientName},\nThe custom aligner quote for Patient ID ${TemplateField.PatientId} is prepared and ready for your review. Please access our Dental Portal to view the detailed quote. We appreciate your attention to providing the best care for our patients.\n\nFor any queries or further assistance, feel free to contact us.\n\nBest regards,\n${TemplateField.PortalName}`,
      [TemplateType.EMAIL]: {
        subject: `Aligner Quote Ready for Patient ID ${TemplateField.PatientId}`,
        body: `Dear ${TemplateField.RecipientName},\nWe are pleased to inform you that the custom aligner quote you requested for Patient ID ${TemplateField.PatientId} is now complete and ready for your review. The quote has been tailored to meet the specific needs of your patient and is available through our Dental Portal.\n\nIf you have any questions or require additional information, please contact us.\n\nBest regards,\n${TemplateField.PortalName}`,
      },
    },
    [RoleCode.TREATMENT_PLANNER]: {
      [TemplateType.NOTIFICATION]: `Your Presentation has been approved by the admin.`,
      [TemplateType.EMAIL]: {
        subject: 'Presentation Approved by Admin',
        body: `Dear ${TemplateField.RecipientName},\nWe are pleased to inform you that your presentation has been approved by the admin.\n\nBest regards,\n${TemplateField.PortalName}`,
      },
      [TemplateType.WHATSAPP]: `Presentation Approved\nHi ${TemplateField.RecipientName},\nGood news! Your presentation has been approved by the admin.\nThanks,\n${TemplateField.PortalName}`,
    },
  },
}
