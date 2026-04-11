const { Events } = require('discord.js');
const { handleRoleDeletion } = require('./antiNuke');

module.exports = {
    name: Events.RoleDelete,
    async execute(role, client) {
        await handleRoleDeletion(role, client);
    },
};
