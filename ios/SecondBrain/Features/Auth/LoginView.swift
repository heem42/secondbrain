import SwiftUI

struct LoginView: View {
    @State private var model: LoginViewModel

    init(auth: AuthService) {
        _model = State(initialValue: LoginViewModel(auth: auth))
    }

    var body: some View {
        NavigationStack {
            Form {
                Picker("Mode", selection: $model.mode) {
                    ForEach(LoginViewModel.Mode.allCases, id: \.self) { mode in
                        Text(mode.rawValue).tag(mode)
                    }
                }
                .pickerStyle(.segmented)
                .listRowBackground(Color.clear)

                Section {
                    TextField("Email", text: $model.email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()

                    SecureField("Password (min 8 chars)", text: $model.password)
                        .textContentType(model.mode == .login ? .password : .newPassword)

                    if model.mode == .signup {
                        TextField("Display name (optional)", text: $model.displayName)
                    }
                }

                if let error = model.errorMessage {
                    Section {
                        Text(error).foregroundStyle(.red).font(.callout)
                    }
                }

                Section {
                    Button(action: { Task { await model.submit() } }) {
                        HStack {
                            Spacer()
                            if model.isBusy { ProgressView() } else { Text(model.mode.rawValue).bold() }
                            Spacer()
                        }
                    }
                    .disabled(!model.canSubmit)
                }
            }
            .navigationTitle("Second Brain")
        }
    }
}
