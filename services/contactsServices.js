const Contact = require("./schemas/contacts");

const getAllContacts = async () => await Contact.find();

const getContactById = async (contactId) => {
  const allContacts = await getAllContacts();
  const contactById = allContacts.find((contact) => contact.id === contactId);

  return contactById || null;
};

const createContact = async ({ name, email, phone, favorite }) => {
  return await Contact.create({ name, email, phone, favorite });
};

const updateContact = async (contactId, fields) => {
  return await Contact.findByIdAndUpdate(contactId, fields, {
    new: true,
    strict: "throw",
    runValidators: true,
  });
};

const updateStatusContact = async (contactId, favorite) => {
  return await Contact.findByIdAndUpdate(contactId, { favorite });
};

const deleteContact = async (contactId) =>
  await Contact.findByIdAndRemove(contactId);

module.exports = {
  getAllContacts,
  getContactById,
  createContact,
  updateContact,
  updateStatusContact,
  deleteContact,
};
