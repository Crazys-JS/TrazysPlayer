import { ChatInputCommandInteraction, Guild, GuildMember, Interaction, SlashCommandBuilder } from 'discord.js';
import Bot from './bot';

export type GuildInteraction = ChatInputCommandInteraction & {guild: Guild, member: GuildMember};

export abstract class Command extends SlashCommandBuilder {
    public constructor(commandName: string, commandDescription: string) {
        super();
        
        this.setName(commandName);
        this.setDescription(commandDescription);
    }

    public abstract execute(bot: Bot, interaction: GuildInteraction): Promise<any>;
}