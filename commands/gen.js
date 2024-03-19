// Dependencies
const { MessageEmbed } = require('discord.js');
const fs = require('fs');
const config = require('../config.json');
const CatLoggr = require('cat-loggr');

// Functions
const log = new CatLoggr();
const cooldowns = new Map(); // Cooldown sürelerini saklamak için bir Map
const dailyLimits = new Map(); // Kullanıcıların günlük limitini saklamak için bir Map

// Günlük sınırlamaları sıfırlamak için bir fonksiyon
function resetDailyLimits() {
  dailyLimits.clear(); // Günlük limitleri temizle
  const currentTime = new Date();
  const resetTime = new Date(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate() + 1); // Yarın aynı saatte sıfırla
  const timeUntilReset = resetTime.getTime() - currentTime.getTime();
  setTimeout(resetDailyLimits, timeUntilReset); // Yarına kadar bekle ve tekrar çağır
}

// Bot başlatıldığında günlük limit sıfırlama fonksiyonunu başlat
resetDailyLimits();

module.exports = {
  name: 'gen',
  description: 'Generate a specified service if stocked',

  /**
   * Command execute
   * @param {Message} message The message sent by user
   * @param {Array[]} args Arguments splitted by spaces after the command name
   */
  execute(message, args) {
    // If the generator channel is not given in config or invalid
    try {
      message.client.channels.cache.get(config.genChannel).id; // Try to get the channel's id
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

    if (message.channel.id === config.genChannel) {
      const userId = message.author.id;
      const currentTime = Date.now();

      // Check if user has reached daily limit
      const userLimitInfo = dailyLimits.get(userId) || { usage: 0, resetTime: currentTime + 24 * 60 * 60 * 1000 };
      if (userLimitInfo.resetTime < currentTime) {
        // Reset daily limit if reset time has passed
        userLimitInfo.usage = 0;
        userLimitInfo.resetTime = currentTime + 24 * 60 * 60 * 1000;
        dailyLimits.set(userId, userLimitInfo);
      }

      if (userLimitInfo.usage >= 2) {
        return message.channel.send(
          new MessageEmbed()
            .setColor(config.color.red)
            .setTitle('Daily Limit Reached!')
            .setDescription(`You have reached your daily limit for using this command! Remaining cooldown: **${Math.floor((userLimitInfo.resetTime - currentTime) / (1000 * 60 * 60))} hours and ${Math.floor((userLimitInfo.resetTime - currentTime) % (1000 * 60 * 60) / (1000 * 60))} minutes.**`)
            .setFooter(message.author.tag, message.author.displayAvatarURL({ dynamic: true, size: 64 }))
            .setTimestamp()
        );
      }

      const cooldownTime = cooldowns.get(userId) || 0;
      const remainingTime = Math.max(0, cooldownTime - currentTime);

      if (remainingTime > 0) {
        return message.channel.send(
          new MessageEmbed()
            .setColor(config.color.red)
            .setTitle('Cooldown!')
            .setDescription(`You are on cooldown. Remaining cooldown: **${Math.floor(remainingTime / 60000)} minutes and ${Math.floor((remainingTime % 60000) / 1000)} seconds.**`)
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

      const filePath = `${__dirname}/../stock/${args[0]}.txt`;

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
            .addField('‎', `\`\`\`${firstLine}\`\`\``, true)
            .setTimestamp();

          message.author.send(embedMessage);

          // Update daily limit usage
          userLimitInfo.usage++;
          dailyLimits.set(userId, userLimitInfo);

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

              cooldowns.set(userId, currentTime + 1200000); // 15 dakika = 900000 milisaniye

              setTimeout(() => {
                cooldowns.delete(userId);

                // Cooldown süresi bittiğinde belirli bir kanala mesaj gönder
                const cooldownChannel = message.client.channels.cache.get(config.genCooldownChannel);

              }, 1200000);

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
          const args = message.content.slice(config.prefix.length).trim().split(/ +/);
          const command = args.shift().toLowerCase();



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
          .setDescription(`You can't use \`gen\` command in this channel! Try it in <#${config.genChannel}>!`)
          .setFooter(message.author.tag, message.author.displayAvatarURL({ dynamic: true, size: 64 }))
          .setTimestamp()
      );
    }
  }
};
