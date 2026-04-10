import Foundation

enum GameForgeEvent: Decodable {
    case message(MessagePayload)
    case tokenStream(TokenPayload)
    case stepAssign(StepAssignPayload)
    case stepUpdate(StepUpdatePayload)
    case systemStats(StatsPayload)
    case gameReady(GameReadyPayload)
    case screenshot(ScreenshotPayload)
    case ghostIntervention(GhostPayload)
    case loopDetected(LoopPayload)
    case toolCall(ToolCallPayload)
    case gameReload(GameReloadPayload)
    case modelSwap(ModelSwapPayload)
    case featureUpdate(FeatureUpdatePayload)
    case gitPush(GitPushPayload)
    case unknown

    enum CodingKeys: String, CodingKey { case type }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let type = try container.decode(String.self, forKey: .type)
        switch type {
        case "message": self = .message(try MessagePayload(from: decoder))
        case "token_stream": self = .tokenStream(try TokenPayload(from: decoder))
        case "step_assign": self = .stepAssign(try StepAssignPayload(from: decoder))
        case "step_update": self = .stepUpdate(try StepUpdatePayload(from: decoder))
        case "system_stats": self = .systemStats(try StatsPayload(from: decoder))
        case "game_ready": self = .gameReady(try GameReadyPayload(from: decoder))
        case "screenshot": self = .screenshot(try ScreenshotPayload(from: decoder))
        case "ghost_intervention": self = .ghostIntervention(try GhostPayload(from: decoder))
        case "loop_detected": self = .loopDetected(try LoopPayload(from: decoder))
        case "tool_call": self = .toolCall(try ToolCallPayload(from: decoder))
        case "game_reload": self = .gameReload(try GameReloadPayload(from: decoder))
        case "model_swap": self = .modelSwap(try ModelSwapPayload(from: decoder))
        case "feature_update": self = .featureUpdate(try FeatureUpdatePayload(from: decoder))
        case "git_push": self = .gitPush(try GitPushPayload(from: decoder))
        default: self = .unknown
        }
    }
}

struct MessagePayload: Decodable {
    let agent: String
    let model: String
    let content: String
    let tokensIn: Int?
    let tokensOut: Int?
    let tokPerSec: Double?
}

struct TokenPayload: Decodable {
    let agent: String
    let token: String
}

struct StepAssignPayload: Decodable {
    let stepId: String
    let title: String
}

struct StepUpdatePayload: Decodable {
    let stepId: String
    let status: String
    let attempt: Int
}

struct StatsPayload: Decodable {
    let cycles: Int
    let uptimeSeconds: Double
    let loopsCaught: Int
    let stepsCompleted: Int
    let stepsTotal: Int
}

struct GameReadyPayload: Decodable {
    let url: String?
}

struct ScreenshotPayload: Decodable {
    let agent: String
    let model: String
    let base64: String
    let description: String
}

struct GhostPayload: Decodable {
    let agent: String
    let model: String
    let trigger: String
    let response: String
}

struct LoopPayload: Decodable {
    let agent: String
    let repeatedTokens: String
    let recoveryAttempt: Int
}

struct ToolCallPayload: Decodable {
    let agent: String
    let model: String
    let tool: String
    let result: String
}

struct GameReloadPayload: Decodable {
    let success: Bool
}

struct ModelSwapPayload: Decodable {
    let loading: String
    let unloading: String?
}

struct FeatureUpdatePayload: Decodable {
    let featureId: String
    let status: String
}

struct GitPushPayload: Decodable {
    let repo: String
    let commit: String
}
