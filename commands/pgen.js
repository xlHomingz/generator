
// Dependencies
const { MessageEmbed } = require('discord.js');
const fs = require('fs');
const config = require('../config.json');
const CatLoggr = require('cat-loggr');

// Functions
const log = new CatLoggr();
const cooldowns = new Map(); // Cooldown sürelerini saklamak için bir Map

module.exports = {
  name: 'pgen',
  description: 'Generate a specified service if stocked',

  /**
   * Command execute
   * @param {Message} message The message sent by user
   * @param {Array[]} args Arguments splitted by spaces after the command name
   */
  execute(message, args) {
    // If the generator channel is not given in config or invalid
    try {
      message.client.channels.cache.get(config.pgenChannel).id; // Try to get the channel's id
    } catch (error) {
      if (error) log.error(error);

      if (config.command.error_message === true) {
        return message.channel.send(
          new MessageEmbed()
            .setColor(config.color.red)
            .setTitle('Error occurred!')
            .setDescription('Not a valid gen channel specified!')
            .setFooter(message.author.tag, message.author.displayAvatarURL({ dynamic: true, size: 64 }))
            .setTimestamp()
        );
      } else return;
    }

    if (message.channel.id === config.pgenChannel) {
      const cooldownTime = cooldowns.get(message.author.id) || 0;
      const remainingTime = Math.max(0, cooldownTime - Date.now());

      if (remainingTime > 0) {
        return message.channel.send(
          new MessageEmbed()
            .setColor(config.color.red)
            .setTitle('Cooldown!')
            .setDescription(`You are on cooldown. Remaining time: **${Math.floor(remainingTime / 60000)} minutes and ${Math.floor((remainingTime % 60000) / 1000)} seconds.**`)
            .setFooter(message.author.tag, message.author.displayAvatarURL({ dynamic: true, size: 64 }))
            .setTimestamp()
        );
      }

      const service = args[0];

      if (!service) {
        return message.channel.send(
          new MessageEmbed()
            .setColor(config.color.red)
            .setTitle('Missing parameters!')
            .setDescription('Please specify a service name!')
            .setFooter(message.author.tag, message.author.displayAvatarURL({ dynamic: true, size: 64 }))
            .setTimestamp()
        );
      }

      const filePath = `${__dirname}/../pstock/${args[0]}.txt`;

      fs.readFile(filePath, function(error, data) {
        if (!error) {
          data = data.toString();
          const position = data.toString().indexOf('\n');
          const firstLine = data.split('\n')[0];

          if (position === -1) {
            return message.channel.send(
              new MessageEmbed()
                .setColor(config.color.red)
                .setTitle('Generator error!')
                .setDescription(`We don't have \`${args[0]}\` currently!`)
                .setFooter(message.author.tag, message.author.displayAvatarURL({ dynamic: true, size: 64 }))
                .setTimestamp()
            );
          }

          const embedMessage = new MessageEmbed()
            .setColor(config.color.green)
            .setTitle('Generated service')
            .addField('Service', `\`\`\`${args[0][0].toUpperCase()}${args[0].slice(1).toLowerCase()}\`\`\``, true)
            .addField('‎ ', `\`\`\`${firstLine}\`\`\``, true)
            .setTimestamp();

          message.author.send(embedMessage);

          if (position !== -1) {
            data = data.substr(position + 1);

            fs.writeFile(filePath, data, function(error) {
              message.channel.send(
                new MessageEmbed()
                  .setColor(config.color.green)
                  .setTitle('Generated successfully!')
                  .setDescription(`Check your private ${message.author}! *If you did not receive the message, please unlock your private!*`)
                  .setFooter(message.author.tag, message.author.displayAvatarURL({ dynamic: true, size: 64 }))
                  .setTimestamp()
              );

              cooldowns.set(message.author.id, Date.now() + 600000); // 10 dakika = 600000 milisaniye

              setTimeout(() => {
                cooldowns.delete(message.author.id);

                // Cooldown süresi bittiğinde belirli bir kanala mesaj gönder
                const cooldownChannel = message.client.channels.cache.get(config.pgenCooldownChannel);

              }, 600000);

              if (error) return log.error(error);
            });
          } else {
            return message.channel.send(
              new MessageEmbed()
                .setColor(config.color.red)
                .setTitle('Generator error!')
                .setDescription(`We don't have \`${args[0]}\` currently!`)
                .setFooter(message.author.tag, message.author.displayAvatarURL({ dynamic: true, size: 64 }))
                .setTimestamp()
            );
          }
        } else {
          return message.channel.send(
            new MessageEmbed()
              .setColor(config.color.red)
              .setTitle('Generator error!')
              .setDescription(`There is no \`${args[0]}\` service! Make sure you wrote it correctly!`)
              .setFooter(message.author.tag, message.author.displayAvatarURL({ dynamic: true, size: 64 }))
              .setTimestamp()
          );
        }
      });
    } else {
      message.channel.send(
        new MessageEmbed()
          .setColor(config.color.red)
          .setTitle('Wrong command usage!')
          .setDescription(`You can't use \`pgen\` command in this channel! Try it in <#${config.pgenChannel}>!`)
          .setFooter(message.author.tag, message.author.displayAvatarURL({ dynamic: true, size: 64 }))
          .setTimestamp()
      );
    }
  }
};
