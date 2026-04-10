const Notification = require('../models/Notification');
const User = require('../models/User');

const createNotification = async ({ recipient, actor, type, title, message, entityType = 'document', entityId, metadata = {} }) => {
  if (!recipient || !actor || !entityId) {
    return null;
  }

  if (String(recipient) === String(actor)) {
    return null;
  }

  try {
    return await Notification.create({
      recipient,
      actor,
      type,
      title,
      message,
      entityType,
      entityId,
      metadata,
    });
  } catch (error) {
    console.error('Create notification error:', error.message);
    return null;
  }
};

const notifyAdmins = async ({ actor, type, title, message, entityType = 'document', entityId, metadata = {} }) => {
  try {
    const admins = await User.find({ role: 'admin', isActive: true }).select('_id');
    if (!admins.length) {
      return;
    }

    const payload = admins
      .map((admin) => ({
        recipient: admin._id,
        actor,
        type,
        title,
        message,
        entityType,
        entityId,
        metadata,
      }))
      .filter((item) => String(item.recipient) !== String(actor));

    if (!payload.length) {
      return;
    }

    await Notification.insertMany(payload, { ordered: false });
  } catch (error) {
    console.error('Notify admins error:', error.message);
  }
};

module.exports = {
  createNotification,
  notifyAdmins,
};
