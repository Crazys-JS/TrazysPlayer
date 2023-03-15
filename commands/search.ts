import Bot from "../library/bot";
import { Command, GuildInteraction } from "../library/command";
import ytsr, { Video } from "ytsr";
import { EmbedBuilder, messageLink } from "@discordjs/builders";
import { AwaitResponse } from "../library/util";
import { TextChannel } from "discord.js";

export default class extends Command {
    public constructor() {
        super("search", "Search a video and add it to queue.");
        this.addStringOption(builder => 
            builder.setName("query")
            .setDescription("Search query.")
            .setMaxLength(100)
            .setRequired(true)
        )
    }
    
    public async execute(bot: Bot, interaction: GuildInteraction): Promise<any> {
        const searchQuery = interaction.options.getString("query", true);
        if(!searchQuery) return interaction.reply("Please put search query.");

        const member = interaction.member;
        const voiceState = member.voice;
        let audio = bot.AudioChannels.get(interaction.guild);
    
        if(!audio) return interaction.reply("I am not in a Voice Channel.");
        if(!voiceState || !voiceState.channel || voiceState.channel !== audio.voiceChannel) return interaction.reply("Please join this Voice Channel.");

        await interaction.deferReply({ephemeral: false});

        const searchResults = await ytsr(searchQuery, {limit: 15, gl: "US", hl: "en"})
        const videos = searchResults.items.filter(x => x.type == "video") as Video[];
        let normalVideos = videos.filter(x => !x.isLive && !x.isUpcoming);

        if(normalVideos.length > 9) {
            normalVideos = normalVideos.splice(0, 9);
        } else if(normalVideos.length <= 0) return interaction.editReply("No results found.")

        const embed = new EmbedBuilder()
        .setTitle("Search Results")
        .setDescription(normalVideos.map((x,i) => `**•${i+1}:** ${x.title} [${x.duration}]`).join('\n'))
        .setFooter({text: "Type the number of the video you want to play."});

        await interaction.editReply({embeds: [embed]});
        const response = await AwaitResponse(interaction.channel as TextChannel, interaction.user, 30_000);
        if(!response.success) return interaction.editReply("You didn't reply in time.");

        const number = parseInt(response.result, 10);
        if(isNaN(number) || number < 1 || number > normalVideos.length) return interaction.editReply("Invalid input.");

        let chosen = normalVideos[number - 1].url;
        const finalResult = await audio.AddTrackToQueue(member, chosen);
        interaction.followUp(finalResult.result);
    }
}