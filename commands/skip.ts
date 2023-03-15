import Bot from "../library/bot";
import { Command, GuildInteraction } from "../library/command";

export default class extends Command {
    public constructor() {
        super("skip", "Skips the current track. Optionally to clear queue.");
        this.addBooleanOption(builder => 
            builder.setName("clear")
            .setDescription("TRUE to clear queue.")    
        )
    }
    
    public async execute(bot: Bot, interaction: GuildInteraction): Promise<any> {
        const fullClear = !!interaction.options.getBoolean("clear", false);
        await interaction.deferReply();

        const member = interaction.member;
        const voiceState = member.voice;
        let audio = bot.AudioChannels.get(interaction.guild);
    
        if(!audio) return interaction.editReply("I am not in a Voice Channel.")
        if(!voiceState || !voiceState.channel || voiceState.channel !== audio.voiceChannel) return interaction.editReply("Please join a Voice Channel first.");
    
        if(fullClear) {
            const result = audio.ClearQueue(member);
            interaction.editReply(result);
        } else {
            const result = await audio.Skip(member);
            interaction.editReply(result.result);
        }
    }
}