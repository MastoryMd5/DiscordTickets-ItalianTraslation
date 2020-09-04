/**
 * 
 *  @name DiscordTickets
 *  @author eartharoid <contact@eartharoid.me>
 *  @license GNU-GPLv3
 * 
 */

const { MessageEmbed } = require('discord.js');
const ChildLogger = require('leekslazylogger').ChildLogger;
const log = new ChildLogger();

module.exports = {
	name: 'add',
	description: 'Aggiungi un membro al canale Supporto',
	usage: '<@member> [... #channel]',
	aliases: ['none'],
	example: 'add @membro to #ticket-23',
	args: true,
	async execute(client, message, args, {config, Ticket}) {

		const guild = client.guilds.cache.get(config.guild);

		const notTicket = new MessageEmbed()
			.setColor(config.err_colour)
			.setAuthor(message.author.username, message.author.displayAvatarURL())
			.setTitle(':x: **Questo non è un canale di Supporto**')
			.setDescription('Use this command in the ticket channel you want to add a user to, or mention the channel.')
			.addField('Usage', `\`${config.prefix}${this.name} ${this.usage}\`\n`)
			.addField('Help', `Usa \`${config.prefix}help ${this.name}\` per informazioni aggiuntive`)
			.setFooter(guild.name, guild.iconURL());

		let ticket;

		let channel = message.mentions.channels.first();

		if(!channel) {

			channel = message.channel;
			ticket = await Ticket.findOne({ where: { channel: message.channel.id } });
			if(!ticket) 
				return message.channel.send(notTicket);

		} else {
		
			ticket = await Ticket.findOne({ where: { channel: channel.id } });
			if(!ticket) {
				notTicket
					.setTitle(':x: **Il canale non è una richiesta di supporto**')
					.setDescription(`${channel} non è una richiesta di supporto.`);
				return message.channel.send(notTicket);
			}
		}

		if(message.author.id !== ticket.creator && !message.member.roles.cache.has(config.staff_role))
			return message.channel.send(
				new MessageEmbed()
					.setColor(config.err_colour)
					.setAuthor(message.author.username, message.author.displayAvatarURL())
					.setTitle(':x: **Senza permesso**')
					.setDescription(`Non hai il permesso di modificare ${channel}, esso non ti appartiene e non sei un membro dello staff.`)
					.addField('Usage', `\`${config.prefix}${this.name} ${this.usage}\`\n`)
					.addField('Help', `Usa \`${config.prefix}help ${this.name}\` per informazioni aggiuntive`)
					.setFooter(guild.name, guild.iconURL())
			);
		
		

		let member = guild.member(message.mentions.users.first() || guild.members.cache.get(args[0]));
		
		if(!member) 
			return message.channel.send(
				new MessageEmbed()
					.setColor(config.err_colour)
					.setAuthor(message.author.username, message.author.displayAvatarURL())
					.setTitle(':x: **Membro sconosciuto**')
					.setDescription('Please mention a valid member.')
					.addField('Usage', `\`${config.prefix}${this.name} ${this.usage}\`\n`)
					.addField('Help', `Type \`${config.prefix}help ${this.name}\` per ulteriori informazioni`)
					.setFooter(guild.name, guild.iconURL())
			);

		try {
			channel.updateOverwrite(member.user, {
				VIEW_CHANNEL: true,
				SEND_MESSAGES: true,
				ATTACH_FILES: true,
				READ_MESSAGE_HISTORY: true
			});

			if(channel.id !== message.channel.id)
				channel.send(
					new MessageEmbed()
						.setColor(config.colour)
						.setAuthor(member.user.username, member.user.displayAvatarURL())
						.setTitle('**Member added**')
						.setDescription(`${member} has been added by ${message.author}`)
						.setFooter(guild.name, guild.iconURL())
				);


			
			message.channel.send(
				new MessageEmbed()
					.setColor(config.colour)
					.setAuthor(member.user.username, member.user.displayAvatarURL())
					.setTitle(':white_check_mark: **Membro aggiunto**')
					.setDescription(`${member} è stato aggiunto a <#${ticket.channel}>`)
					.setFooter(guild.name, guild.iconURL())
			);
			
			log.info(`${message.author.tag} added a user to a ticket (#${message.channel.id})`);
		} catch (error) {
			log.error(error);
		}
		// command ends here
	},
};
