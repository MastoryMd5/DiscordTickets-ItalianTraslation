/**
 * 
 *  @name DiscordTickets
 *  @author eartharoid <contact@eartharoid.me>
 *  @license GNU-GPLv3
 * 
 */

const ChildLogger = require('leekslazylogger').ChildLogger;
const log = new ChildLogger();
const {
	MessageEmbed
} = require('discord.js');
const fs = require('fs');
const archive = require('../modules/archive');

module.exports = {
	name: 'close',
	description: 'Chiudi una richiesta di supporto; menzionando il canale o usandolo all\'interno di esso.',
	usage: '[ticket]',
	aliases: ['none'],
	example: 'close #ticket-17',
	args: false,
	async execute(client, message, args, {
		config,
		Ticket
	}) {

		const guild = client.guilds.cache.get(config.guild);

		const notTicket = new MessageEmbed()
			.setColor(config.err_colour)
			.setAuthor(message.author.username, message.author.displayAvatarURL())
			.setTitle(':x: **Questa non è una richiesta di supporto**')
			.setDescription('Usa questo comando all\'interno della richiesta di supporto.')
			.addField('Usage', `\`${config.prefix}${this.name} ${this.usage}\`\n`)
			.addField('Help', `Usa \`${config.prefix}help ${this.name}\` per ulteriori informazioni`)
			.setFooter(guild.name, guild.iconURL());

		let ticket;
		let channel = message.mentions.channels.first();
		// || client.channels.resolve(await Ticket.findOne({ where: { id: args[0] } }).channel) // channels.fetch()

		if (!channel) {
			channel = message.channel;

			ticket = await Ticket.findOne({
				where: {
					channel: channel.id
				}
			});
			if (!ticket)
				return channel.send(notTicket);

		} else {

			ticket = await Ticket.findOne({
				where: {
					channel: channel.id
				}
			});
			if (!ticket) {
				notTicket
					.setTitle(':x: **Il canale è una richiesta di supporto**')
					.setDescription(`${channel} non è una richiesta di supporto.`);
				return message.channel.send(notTicket);
			}

			if (message.author.id !== ticket.creator && !message.member.roles.cache.has(config.staff_role))
				return channel.send(
					new MessageEmbed()
						.setColor(config.err_colour)
						.setAuthor(message.author.username, message.author.displayAvatarURL())
						.setTitle(':x: **Permesso negato**')
						.setDescription(`Non hai il permesso per chiudere ${channel}, esso non ti appartiene e non sei membro dello staff.`)
						.addField('Usage', `\`${config.prefix}${this.name} ${this.usage}\`\n`)
						.addField('Help', `Usa \`${config.prefix}help ${this.name}\` per ulteriori informazioni`)
						.setFooter(guild.name, guild.iconURL())
				);
		}

		let success;
		let pre = fs.existsSync(`user/transcripts/text/${channel.id}.txt`) ||
			fs.existsSync(`user/transcripts/raw/${channel.id}.log`) ?
			`Sarai in grado di vedere una versione archiviata a \`${config.prefix}transcript ${ticket.id}\`` :
			'';

		let confirm = await message.channel.send(
			new MessageEmbed()
				.setColor(config.colour)
				.setAuthor(message.author.username, message.author.displayAvatarURL())
				.setTitle(':grey_question: Sei sicuro?')
				.setDescription(`${pre}\n**Reagisci con :white_check_mark: per confermare.**`)
				.setFooter(guild.name + ' | L\'operazione si annullerà tra 15 secondi', guild.iconURL())
		);

		await confirm.react('✅');

		const collector = confirm.createReactionCollector(
			(r, u) => r.emoji.name === '✅' && u.id === message.author.id, {
				time: 15000
			});

		collector.on('collect', async () => {
			if (channel.id !== message.channel.id)
				channel.send(
					new MessageEmbed()
						.setColor(config.colour)
						.setAuthor(message.author.username, message.author.displayAvatarURL())
						.setTitle('**Richiesta di supporto archiviata**')
						.setDescription(`Richiesta archiviata da ${message.author}`)
						.setFooter(guild.name, guild.iconURL())
				);

			confirm.reactions.removeAll();
			confirm.edit(
				new MessageEmbed()
					.setColor(config.colour)
					.setAuthor(message.author.username, message.author.displayAvatarURL())
					.setTitle(`:white_check_mark: **Richiest di supporto ${ticket.id} archiviata**`)
					.setDescription('Il canale sarà automaticamente rimosso.')
					.setFooter(guild.name, guild.iconURL())
			);

			if (config.transcripts.text.enabled || config.transcripts.web.enabled) {
				let u = await client.users.fetch(ticket.creator);

				if (u) {
					let dm;
					try {
						dm = u.dmChannel || await u.createDM();
					} catch (e) {
						log.warn(`Impossibile creare il canale ${u.tag}`);
					}


					let res = {};
					const embed = new MessageEmbed()
						.setColor(config.colour)
						.setAuthor(message.author.username, message.author.displayAvatarURL())
						.setTitle(`Ticket ${ticket.id}`)
						.setFooter(guild.name, guild.iconURL());

					if (fs.existsSync(`user/transcripts/text/${ticket.get('channel')}.txt`)) {
						embed.addField('Text transcript', 'See attachment');
						res.files = [{
							attachment: `user/transcripts/text/${ticket.get('channel')}.txt`,
							name: `ticket-${ticket.id}-${ticket.get('channel')}.txt`
						}];
					}

					if (
						fs.existsSync(`user/transcripts/raw/${ticket.get('channel')}.log`)
						&&
						fs.existsSync(`user/transcripts/raw/entities/${ticket.get('channel')}.json`)
					) 
						embed.addField('Web archive', `${await archive.export(Ticket, channel)}`);
						
			
					if (embed.fields.length < 1)
						embed.setDescription(`No text transcripts or archive data exists for ticket ${ticket.id}`);

					res.embed = embed;

					dm.send(res).then();
				}
			}


			// update database
			success = true;
			ticket.update({
				open: false
			}, {
				where: {
					channel: channel.id
				}
			});

			// delete messages and channel
			setTimeout(() => {
				channel.delete();
				if (channel.id !== message.channel.id)
					message.delete()
						.then(() => confirm.delete());
			}, 5000);

			log.info(`${message.author.tag} ha chiuso la richiesta di supporto (#ticket-${ticket.id})`);

			if (config.logs.discord.enabled)
				client.channels.cache.get(config.logs.discord.channel).send(
					new MessageEmbed()
						.setColor(config.colour)
						.setAuthor(message.author.username, message.author.displayAvatarURL())
						.setTitle('Richiesta chiusa')
						.addField('Creatore', `<@${ticket.creator}>`, true)
						.addField('Chiusa da', message.author, true)
						.setFooter(guild.name, guild.iconURL())
						.setTimestamp()
				);
		});


		collector.on('end', () => {
			if (!success) {
				confirm.reactions.removeAll();
				confirm.edit(
					new MessageEmbed()
						.setColor(config.err_colour)
						.setAuthor(message.author.username, message.author.displayAvatarURL())
						.setTitle(':x: **Tempo scaduto**')
						.setDescription('Hai impiegato troppo tempo per reagire; conferma annullata.')
						.setFooter(guild.name, guild.iconURL()));

				message.delete({
					timeout: 10000
				})
					.then(() => confirm.delete());
			}
		});

	}
};
