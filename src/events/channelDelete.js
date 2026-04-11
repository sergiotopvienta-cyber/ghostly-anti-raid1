const { Events } = require('discord.js');
const { handleChannelDeletion } = require('./antiNuke');

module.exports = {
    name: Events.ChannelDelete,
    async execute(channel, client) {
        await handleChannelDeletion(channel, client);
    },
};
