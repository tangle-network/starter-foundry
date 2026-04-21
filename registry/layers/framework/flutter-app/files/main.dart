import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

void main() {
  runApp(const StarterFoundryApp());
}

/// App-wide session state. Swap for Riverpod / BLoC as product complexity
/// grows; Provider keeps the surface small for the starter.
class SessionModel extends ChangeNotifier {
  bool _authenticated = false;
  String? _userEmail;

  bool get authenticated => _authenticated;
  String? get userEmail => _userEmail;

  void signIn(String email) {
    _authenticated = true;
    _userEmail = email;
    notifyListeners();
  }

  void signOut() {
    _authenticated = false;
    _userEmail = null;
    notifyListeners();
  }
}

/// HTTP client surface. Auth-refresh + logging interceptors plug in here.
class ApiClient {
  ApiClient({String baseUrl = 'https://api.example.com'})
      : _dio = Dio(BaseOptions(baseUrl: baseUrl, connectTimeout: const Duration(seconds: 10)));

  final Dio _dio;

  Future<Map<String, dynamic>> health() async {
    final response = await _dio.get<Map<String, dynamic>>('/health');
    return response.data ?? <String, dynamic>{};
  }
}

final GoRouter _router = GoRouter(
  initialLocation: '/',
  routes: <RouteBase>[
    GoRoute(
      path: '/',
      builder: (BuildContext context, GoRouterState state) => const HomeScreen(),
    ),
    GoRoute(
      path: '/auth',
      builder: (BuildContext context, GoRouterState state) => const AuthScreen(),
    ),
    GoRoute(
      path: '/billing',
      builder: (BuildContext context, GoRouterState state) => const BillingScreen(),
    ),
  ],
);

class StarterFoundryApp extends StatelessWidget {
  const StarterFoundryApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider<SessionModel>(create: (_) => SessionModel()),
        Provider<ApiClient>(create: (_) => ApiClient()),
      ],
      child: MaterialApp.router(
        title: '{{projectName}}',
        theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF4F46E5)),
          useMaterial3: true,
        ),
        routerConfig: _router,
      ),
    );
  }
}

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final SessionModel session = context.watch<SessionModel>();
    return Scaffold(
      appBar: AppBar(title: const Text('{{headline}}')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              Text(
                '{{subheadline}}',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 24),
              _SectionCard(
                title: 'Auth',
                body: session.authenticated
                    ? 'Signed in as ${session.userEmail ?? 'unknown'}'
                    : 'Wire sign-in + account recovery at lib/services/auth.',
                onTap: () => context.go('/auth'),
              ),
              const SizedBox(height: 12),
              _SectionCard(
                title: 'Billing',
                body: 'Attach premium purchase / subscription flows.',
                onTap: () => context.go('/billing'),
              ),
              const SizedBox(height: 12),
              const _SectionCard(
                title: 'Wallet',
                body: 'Connect a mobile wallet or partner SDK here.',
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class AuthScreen extends StatelessWidget {
  const AuthScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Sign in')),
      body: Center(
        child: FilledButton(
          onPressed: () {
            context.read<SessionModel>().signIn('demo@{{packageName}}.app');
            context.go('/');
          },
          child: const Text('Demo sign in'),
        ),
      ),
    );
  }
}

class BillingScreen extends StatelessWidget {
  const BillingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Billing')),
      body: const Center(child: Text('Payments slot renders here.')),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.title, required this.body, this.onTap});

  final String title;
  final String body;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(title, style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 6),
              Text(body, style: Theme.of(context).textTheme.bodyMedium),
            ],
          ),
        ),
      ),
    );
  }
}
