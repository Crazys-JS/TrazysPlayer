import Bot from "../library/bot";
import { Command, GuildInteraction } from "../library/command";

export default class extends Command {
    public constructor() {
        super("hi", "Say hi to Trazys Bot!");
    }
    
    public async execute(bot: Bot, interaction: GuildInteraction): Promise<any> {
        interaction.reply("Hi!");
    }
}