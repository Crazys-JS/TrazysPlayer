import { Message, ActionRowBuilder as MessageActionRow, ButtonBuilder as MessageButton, EmbedBuilder as MessageEmbed, TextChannel, ButtonInteraction, User, ComponentType, ButtonStyle, AnyComponentBuilder } from "discord.js";
import { GuildInteraction } from "./command";
import { AwaitResponse } from "./util";

export default class PageEmbed {

    /**Function for processing a given page. */
    public processPage: (page: number) => [MessageEmbed, number];

    /**The current page of the embed. */
    private _currentPage: number;

    /**The amount of pages. */
    private _maxPages: number;

    /**The message that this embed is in. */
    private _parentMessage: Message;

    /**The user that sent the original request. */
    private _sender: User;

    private constructor(parent: Message, sender: User, pageCount: number, callback: (page: number) => [MessageEmbed, number]) {
        this._parentMessage = parent;
        this.processPage = callback;
        this._currentPage = 0;
        this._sender = sender;
        this._maxPages = pageCount;

        this.UpdateCollector();
    };

    private async UpdateCollector() {
        const parent = this._parentMessage;
        
        const filter = (a: ButtonInteraction) => a.user.id == this._sender.id;
        const collector = parent.createMessageComponentCollector({filter: filter, componentType: ComponentType.Button, max: 1, time: 30000});

        collector.on("collect", async (collected) => {
            let newPage = this._currentPage;

            switch(collected.customId) {
                case "last":
                    newPage = this._maxPages - 1;
                    break
                case "previous":
                    newPage--

                    if(newPage < 0) {
                        newPage = this._maxPages - 1;
                    };

                    break
                case "next":
                    newPage++

                    if(newPage > this._maxPages - 1) {
                        newPage = 0;
                    };

                    break
                case "first":
                    newPage = 0;
                    break
                case "jump":
                    try {
                        const components = PageEmbed.GetComponents(0, 1);
                        components.components.map(x => x.setDisabled(true));
                        (components.components[4] as MessageButton).setStyle(ButtonStyle.Secondary);

                        await collected.update({components: [components]});
                        const msg = await this._parentMessage.reply({content: `${this._sender},, Type the page you want to go to.`});
                        const response = await AwaitResponse(parent.channel as TextChannel, this._sender, 30000);

                        if(response.success) {

                            const toNumber = parseInt(response.result, 10);
                            if(!toNumber || toNumber <= 0 || toNumber > this._maxPages) {
                                await parent.channel.send(`${this._sender}, invalid page.`);
                            } else {
                                newPage = toNumber - 1;
                            };

                            if(response.message && response.message.deletable) {
                                response.message.delete();
                            };

                        } else {
                            await parent.channel.send(`${this._sender}, you didn't respond in time.`);
                        }

                        await msg.delete();

                    } catch(err) {
                        console.warn(err)
                    };
            };

            await this.ChangePage(newPage, collected);
            this.UpdateCollector();
        });

        collector.on('end', collected => {
            if(collected.size <= 0) {
                const values = this.GetPage(this._currentPage);
                const embed = values[0];
                
                parent.edit({embeds: [embed], components: []}).catch(err => console.warn(err));
            };
        });
    };

    private static GetComponents(currentPage: number, maxPages: number): MessageActionRow<MessageButton> {
        const buttonFirst = new MessageButton()
        .setCustomId("first")
        .setDisabled(currentPage == 0)
        .setStyle(ButtonStyle.Primary)
        .setEmoji("⏮️");

        const buttonLeft = new MessageButton()
        .setCustomId("previous")
        .setDisabled(maxPages <= 1)
        .setStyle(ButtonStyle.Primary)
        .setEmoji("⬅️");

        const buttonRight = new MessageButton()
        .setCustomId("next")
        .setDisabled(maxPages <= 1)
        .setStyle(ButtonStyle.Primary)
        .setEmoji("➡️");

        const buttonLast = new MessageButton()
        .setCustomId("last")
        .setDisabled(currentPage >= maxPages - 1)
        .setStyle(ButtonStyle.Primary)
        .setEmoji("⏭️");

        const buttonJump = new MessageButton()
        .setCustomId("jump")
        .setDisabled(maxPages <= 1)
        .setStyle(ButtonStyle.Primary)
        .setEmoji("⤴️")

        const row = new MessageActionRow<MessageButton>()
        .addComponents(buttonFirst, buttonLeft, buttonRight, buttonLast, buttonJump);

        return row;
    };

    private GetPage(page: number) {
        const values = this.processPage(page);
        values[0].setTitle(`Page ${page + 1} | ${values[1]}`);

        return values
    };

    private async ChangePage(page: number, interaction: ButtonInteraction) {
        const values = this.GetPage(page);
        const embed = values[0];
        const maxPages = values[1];

        this._currentPage = page;
        this._maxPages = maxPages;

        try {
            if(!interaction.replied) {
                await interaction.update({embeds: [embed], components: [PageEmbed.GetComponents(page, maxPages)]});
            } else {
                await this._parentMessage.edit({embeds: [embed], components: [PageEmbed.GetComponents(page, maxPages)]});
            };
        } catch(err) {
            console.warn(err);
        };
    };

    public static async FromMessage(message: Message, callback: (page: number) => [MessageEmbed, number]): Promise<PageEmbed | null> {
        try {
            const values = callback(0);
            const embed = values[0];
            const maxPages = values[1];

            embed.setTitle(`Page 1 | ${maxPages}`);

            const reply = await message.reply({embeds: [embed], components: [PageEmbed.GetComponents(0, maxPages)]});
            const object = new PageEmbed(reply, message.author, maxPages, callback);
            return object;
        } catch(err) {
            return null;
        };
    };

    public static async FromInteraction(interaction: GuildInteraction, callback: (page: number) => [MessageEmbed, number]): Promise<PageEmbed | null> {
        try {
            const values = callback(0);
            const embed = values[0];
            const maxPages = values[1];

            embed.setTitle(`Page 1 | ${maxPages}`);

            const reply = await interaction.reply({embeds: [embed], components: [PageEmbed.GetComponents(0, maxPages)]});
            const object = new PageEmbed(await reply.fetch(), interaction.user, maxPages, callback);
            return object;
        } catch(err) {
            return null;
        };
    };

    public static async FromChannel(channel: TextChannel, sender: User, callback: (page: number) => [MessageEmbed, number]): Promise<PageEmbed | null> {
        try {
            const values = callback(0);
            const embed = values[0];
            const maxPages = values[1];

            embed.setTitle(`Page 1 | ${maxPages}`);

            const message = await channel.send({embeds: [embed], components: [PageEmbed.GetComponents(0, maxPages)]});
            const object = new PageEmbed(message, sender, maxPages, callback);
            return object;
        } catch(err) {
            return null
        };
    };


};